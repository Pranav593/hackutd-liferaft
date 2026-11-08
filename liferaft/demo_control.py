"""One opt-in demo slot. This dispatches existing workers; leases remain job-scoped."""
import json
import time

SLOT = "live-demo-control"
ROLES = ("pi_primary", "standby", "gateway")
READY_SECONDS = 15
RUN_SECONDS = 315
STAGES = {"starting", "training", "waiting_checkpoint", "armed", "triggered", "finished", "failed"}


def update(policy, change=None):
    with policy.transaction() as db:
        db.execute("CREATE TABLE IF NOT EXISTS demo_slot (id INTEGER PRIMARY KEY, body TEXT NOT NULL)")
        row = db.execute("SELECT body FROM demo_slot WHERE id=1").fetchone()
        state = json.loads(row[0]) if row else {"agents": {}, "run": None}
        if change is not None:
            change(state, time.time())
            db.execute("INSERT OR REPLACE INTO demo_slot VALUES (1, ?)", (json.dumps(state),))
        return state


def slot(repository, change=None):
    operation = lambda policy: update(policy, change)
    try:
        return repository.execute(SLOT, operation)
    except ValueError:
        # Two initial agents may discover the empty slot together.
        try:
            repository.execute(SLOT, update, create=True)
        except ValueError:
            pass
        return repository.execute(SLOT, operation)


def ready_agents(state, now):
    return {role: role in state["agents"] and now - state["agents"][role]["at"] <= READY_SECONDS
            for role in ROLES}


def reserve(state, now, job, replace_job):
    current = state["run"]
    if current and current["phase"] != "failed" and now - current["at"] < (
            30 if current["phase"] == "starting" else RUN_SECONDS):
        if current["job"] != replace_job:
            raise ValueError("a live demo is already active")
    readiness = ready_agents(state, now)
    if not all(readiness.values()):
        raise ValueError("all three device agents must be ready")
    state["run"] = {"job": job, "at": now, "phase": "starting", "devices": {}}


def publish(state, job, phase):
    if state["run"] is not None and state["run"]["job"] == job:
        state["run"]["phase"] = phase


def poll(state, now, role, instance, readiness):
    agents = state["agents"]
    if readiness == "ready":
        agents[role] = {"at": now}
    elif role in agents:
        agents.pop(role)
    run = state["run"]
    if readiness != "ready" or not run or run["phase"] != "assigned" or now - run["at"] >= RUN_SECONDS:
        return
    device = run["devices"].get(role)
    if device is None:
        run["devices"][role] = {"instance": instance, "stage": "starting", "at": now}
    elif device["instance"] != instance:
        return


def assignment(state, role, instance):
    run = state["run"]
    if not run or run["phase"] != "assigned" or time.time() - run["at"] >= RUN_SECONDS:
        return None
    device = run["devices"].get(role)
    return run["job"] if device and device["instance"] == instance and device["stage"] == "starting" else None


def report(state, now, role, instance, job, stage, reason):
    run = state["run"]
    device = run["devices"].get(role) if run and run["job"] == job else None
    if device is None or device["instance"] != instance:
        raise ValueError("device has no assignment for this run")
    device.update(stage=stage, at=now, reason=reason)
    state["agents"].pop(role, None)


def public_state(state):
    run = state["run"]
    if run:
        run = {**run, "devices": {role: {k: v for k, v in device.items() if k != "instance"}
                                   for role, device in run["devices"].items()}}
    return {"ready": ready_agents(state, time.time()), "run": run}
