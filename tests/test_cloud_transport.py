"""HTTPS transport defenses and signed-protocol selection, without network."""
import io
import json
import unittest
from unittest.mock import Mock

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
