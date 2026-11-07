"""An immutable local artifact store with atomic, no-overwrite publication."""
import hashlib
import hmac
import os
import tempfile
from pathlib import Path
from typing import BinaryIO, Callable

from .contracts import MAX_CHECKPOINT_BYTES, CheckpointManifest


class IntegrityError(ValueError):
    pass


def publish(path: Path, writer: Callable[[BinaryIO], object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with tempfile.NamedTemporaryFile(dir=path.parent, prefix=".pending-", delete=False) as temporary:
        staged = Path(temporary.name)
        try:
            with temporary:
                writer(temporary)
                temporary.flush()
                os.fsync(temporary.fileno())
            # Linking is an atomic publish that refuses an already published name.
            os.link(staged, path)
            if os.name != "nt":
                fd = os.open(path.parent, os.O_RDONLY)
                try:
                    os.fsync(fd)
                finally:
                    os.close(fd)
        finally:
            staged.unlink(missing_ok=True)


class LocalArtifactStore:
    def __init__(self, root: Path):
        self.root = root

    def path_for(self, key: str) -> Path:
        path = (self.root / key).resolve()
        if not path.is_relative_to(self.root.resolve()):
            raise IntegrityError("artifact outside project store")
        return path

    def put(self, key: str, writer: Callable[[BinaryIO], object]) -> Path:
        path = self.path_for(key)
        publish(path, writer)
        return path

    def verified_bytes(self, manifest: CheckpointManifest) -> bytes:
        return verified_bytes(self.path_for(manifest.path), manifest)


def verified_bytes(path: Path, manifest: CheckpointManifest) -> bytes:
    with path.open("rb") as stream:
        data = stream.read(MAX_CHECKPOINT_BYTES + 1)
    if len(data) != manifest.size_bytes:
        raise IntegrityError("checkpoint byte count mismatch")
    if not hmac.compare_digest(hashlib.sha256(data).hexdigest(), manifest.sha256):
        raise IntegrityError("checkpoint SHA-256 mismatch")
    return data
