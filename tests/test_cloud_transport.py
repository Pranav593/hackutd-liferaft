"""HTTPS transport defenses and signed-protocol selection, without network."""
import io
import json
import unittest
from unittest.mock import Mock, patch
from urllib.error import HTTPError, URLError

from liferaft.artifacts import IntegrityError
from liferaft.cloud import CloudClient
from liferaft.transfers import issue_ticket
from test_transfers import fixture_manifest


class TransportTests(unittest.TestCase):
    def setUp(self):
        self.client = CloudClient("https://coordinator.test", "a" * 64)
        self.manifest, self.data = fixture_manifest()
        self.url = "/v1/checkpoint?ticket=" + issue_ticket(self.manifest, "primary", "PUT", "a" * 64)
        self.client.opener = Mock()

    def test_urls_cannot_redirect_credentials(self):
        for url in ("https://evil.test" + self.url, "//evil.test" + self.url,
                    self.url + "#fragment", self.url + "&other=1", "/v1/control", "\\evil.test"):
            with self.subTest(url=url[:30]), self.assertRaises(ValueError):
                self.client.transfer(url, "PUT", data=self.data)
        self.client.opener.open.assert_not_called()

    def test_binary_upload_and_download_verify_exact_bytes(self):
        self.client.call = Mock(return_value={"signed_url": self.url})
        self.client.opener.open.return_value = io.BytesIO(b'{"result":true}')
        self.assertTrue(self.client.upload_checkpoint(self.manifest, self.data))
        request = self.client.opener.open.call_args.args[0]
        self.assertEqual((request.method, request.data), ("PUT", self.data))
        self.assertTrue(request.full_url.startswith("https://coordinator.test/v1/checkpoint?"))
        self.client.opener.open.return_value = io.BytesIO(self.data)
        self.assertEqual(self.client.download_checkpoint(self.manifest), self.data)
        self.client.opener.open.return_value = io.BytesIO(b"x" * len(self.data))
        with self.assertRaises(IntegrityError):
            self.client.download_checkpoint(self.manifest)
        self.client.opener.open.return_value = io.BytesIO(self.data + b"x")
        with self.assertRaisesRegex(RuntimeError, "checkpoint transfer"):
            self.client.download_checkpoint(self.manifest)

    def test_protocol_negotiation_is_cached(self):
        for result, expected in (({"checkpoint_transfer": "signed-v1"}, True), ({}, False)):
            self.client._signed_transfers = None
            self.client.call = Mock(return_value=result)
            self.assertEqual(self.client.supports_signed_transfers(), expected)
            self.assertEqual(self.client.supports_signed_transfers(), expected)
            self.client.call.assert_called_once_with("doctor")

    @patch("liferaft.cloud.time.sleep")
    def test_transient_read_retries_are_bounded(self, sleep):
        self.client.opener.open.side_effect = [
            HTTPError("https://private.test/?ticket=secret", 503, "unavailable", {}, io.BytesIO(b"secret")),
            URLError("secret network detail"), io.BytesIO(b'{"result":{"auth":true}}')]
        self.assertEqual(self.client.call("doctor"), {"auth": True})
        self.assertEqual(self.client.opener.open.call_count, 3)
        self.assertEqual(sleep.call_count, 2)
        requests = [call.args[0] for call in self.client.opener.open.call_args_list]
        self.assertIs(requests[0], requests[2])
        self.assertTrue(all(call.kwargs["timeout"] <= 2 for call in self.client.opener.open.call_args_list))

    @patch("liferaft.cloud.time.sleep")
    def test_ownership_mutations_and_permanent_errors_never_retry(self, sleep):
        for action in ("start", "claim", "yield", "resumed", "complete", "create"):
            self.client.opener.open.reset_mock()
            self.client.opener.open.side_effect = URLError("private connection details")
            with self.subTest(action=action), self.assertRaisesRegex(RuntimeError, "unavailable") as caught:
                self.client.call(action, "job")
            self.assertNotIn("private", str(caught.exception))
            self.client.opener.open.assert_called_once()
        self.client.opener.open.reset_mock()
        self.client.opener.open.side_effect = HTTPError("private", 403, "secret", {}, io.BytesIO(b"secret"))
        with self.assertRaisesRegex(RuntimeError, "HTTP 403"):
            self.client.call("doctor")
        self.client.opener.open.assert_called_once()
        sleep.assert_not_called()

    @patch("liferaft.cloud.time.sleep")
    def test_exhaustion_and_invalid_responses_fail_closed(self, sleep):
        self.client.opener.open.side_effect = URLError("private")
        with self.assertRaises(RuntimeError):
            self.client.call("doctor")
        self.assertEqual(self.client.opener.open.call_count, 3)
        self.client.opener.open.side_effect = None
        for raw in (b"null", b"[]", b"{}", b"not-json"):
            self.client.opener.open.return_value = io.BytesIO(raw)
            with self.subTest(raw=raw), self.assertRaisesRegex(RuntimeError, "invalid coordinator response"):
                self.client.call("doctor")
