"""Small deterministic CPU regression job."""
import hashlib
import random
import struct
import time
from pathlib import Path

import numpy as np
import torch

FEATURES = 32
BATCH = 32
SAMPLES = 1024
MODEL_VERSION = "tinymlp-v1"
MAX_STEPS = 10_000
CONFIG_FINGERPRINT = hashlib.sha256(
    Path(__file__).read_text(encoding="utf-8").encode("utf-8")
).hexdigest()


def make_dataset(seed: int) -> tuple[torch.Tensor, torch.Tensor, str]:
    rng = random.Random(seed)
    coefficients = [rng.randrange(-8, 9) for _ in range(FEATURES)]
    data, targets = [], []
    digest = hashlib.sha256()
    for _ in range(SAMPLES):
        row = [rng.randrange(-64, 64) for _ in range(FEATURES)]
        target = sum(x * w for x, w in zip(row, coefficients)) + rng.randrange(-8, 9)
        digest.update(struct.pack("<32bi", *row, target))
        data.append(row)
        targets.append(target)
    return (torch.tensor(data, dtype=torch.float32) / 64,
            torch.tensor(targets, dtype=torch.float32).reshape(-1, 1) / 1024,
            digest.hexdigest())


class TrainingSession:
    def __init__(self, seed: int):
        if not 0 <= seed < 2**32:
            raise ValueError("seed must be between 0 and 4294967295")
        torch.set_num_threads(1)
        torch.use_deterministic_algorithms(True)
        random.seed(seed)
        np.random.seed(seed)
        torch.manual_seed(seed)
        self.seed = seed
        self.features, self.targets, self.dataset_fingerprint = make_dataset(seed)
        self.model = torch.nn.Sequential(
            torch.nn.Linear(FEATURES, 64), torch.nn.ReLU(), torch.nn.Dropout(0.1), torch.nn.Linear(64, 1),
        ).cpu()
        self.optimizer = torch.optim.AdamW(self.model.parameters(), lr=0.004, foreach=False, fused=False)
        self.step = 0
        self.cursor = 0
        self.losses: list[float] = []

    def advance(self) -> tuple[float, float]:
        started = time.perf_counter()
        end = self.cursor + BATCH
        features, targets = self.features[self.cursor:end], self.targets[self.cursor:end]
        self.optimizer.zero_grad(set_to_none=True)
        loss = torch.nn.functional.mse_loss(self.model(features), targets)
        if not torch.isfinite(loss).item():
            raise ValueError("non-finite training loss")
        loss.backward()
        self.optimizer.step()
        self.step += 1
        self.cursor = end % SAMPLES
        value = loss.item()
        self.losses.append(value)
        return value, (time.perf_counter() - started) * 1000

    def state(self) -> dict:
        name, keys, position, gaussian, cached = np.random.get_state()
        return {
            "seed": self.seed, "cursor": self.cursor, "loss_history": self.losses.copy(),
            "model": self.model.state_dict(), "optimizer": self.optimizer.state_dict(),
            "torch_rng": torch.get_rng_state(), "python_rng": random.getstate(),
            "numpy_rng": (name, keys.tolist(), position, gaussian, cached),
        }

    def restore(self, state: dict, step: int) -> None:
        losses = state["loss_history"]
        if (step > MAX_STEPS or state["cursor"] != step * BATCH % SAMPLES
                or len(losses) != step or any(not np.isfinite(loss) or loss < 0 for loss in losses)):
            raise ValueError("checkpoint cursor or loss history is inconsistent")
        self.model.load_state_dict(state["model"], strict=True)
        self.optimizer.load_state_dict(state["optimizer"])
        for group in self.optimizer.param_groups:
            for parameter in group["params"]:
                slot = self.optimizer.state[parameter]
                if (set(slot) != {"step", "exp_avg", "exp_avg_sq"} or slot["step"].item() != step
                        or any(slot[key].shape != parameter.shape for key in ("exp_avg", "exp_avg_sq"))):
                    raise ValueError("checkpoint optimizer state is inconsistent")
        name, keys, position, gaussian, cached = state["numpy_rng"]
        np.random.set_state((name, np.array(keys, dtype=np.uint32), position, gaussian, cached))
        random.setstate(state["python_rng"])
        torch.set_rng_state(state["torch_rng"])
        self.cursor = state["cursor"]
        self.step = step
        self.losses = losses.copy()
