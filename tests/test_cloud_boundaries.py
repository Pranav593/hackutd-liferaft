"""Adversarial HTTP envelopes; no network or training dependencies."""
import io
import json
import time
import unittest

from liferaft.cloud_api import MAX_CONTROL_BODY, application


class Repository:
    def ping(self):
        pass


class EnvelopeTests(unittest.TestCase):
    def setUp(self):
        self.app = application(Repository(), {"primary": "a" * 64, "standby": "b" * 64,
                                              "operator": "c" * 64})

    def send(self, raw, length=None):
        captured = []
        body = self.app({"REQUEST_METHOD": "POST", "PATH_INFO": "/v1/control",
                         "HTTP_AUTHORIZATION": "Bearer " + "c" * 64,
                         "CONTENT_LENGTH": str(len(raw) if length is None else length),
                         "wsgi.input": io.BytesIO(raw)},
                        lambda status, headers: captured.append(status))
        return int(captured[0].split()[0]), json.loads(b"".join(body))

    def test_ambiguous_or_nonfinite_envelopes_are_rejected(self):
        valid = {"action": "doctor", "job": None, "sent_at": time.time(), "args": {}}
        for replacement in (True, "NaN", float("nan"), float("inf")):
            with self.subTest(replacement=replacement):
                self.assertEqual(self.send(json.dumps(valid | {"sent_at": replacement}).encode())[0], 422)
        duplicate = ('{"action":"doctor","action":"status","sent_at":%s}' % time.time()).encode()
        self.assertEqual(self.send(duplicate)[0], 422)
        self.assertEqual(self.send(b"[]")[0], 422)

    def test_truncation_and_control_size_limits(self):
        self.assertEqual(self.send(b"{}", length=3)[0], 400)
        large = json.dumps({"action": "doctor", "sent_at": time.time(),
                            "args": {"padding": "x" * MAX_CONTROL_BODY}}).encode()
        self.assertEqual(self.send(large)[0], 413)
        self.assertEqual(self.send(b"{}", length=-1)[0], 413)
        self.assertEqual(self.send(b"{}", length="invalid")[0], 422)
