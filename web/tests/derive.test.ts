import { describe, it, expect } from "vitest";
import { topologyFrame } from "../src/lib/derive/topology-frame";
import { handoff } from "../src/lib/derive/handoff";
import { epochs } from "../src/lib/derive/epochs";
import { ledger } from "../src/lib/derive/ledger";
import { lossSegments } from "../src/lib/derive/loss";
import { relations } from "../src/lib/derive/relations";
import { beats, matches, defaultFilters } from "../src/lib/derive/timeline";
import type { Replay } from "../src/lib/replay";
import local from "../fixtures/replay.local-job.json";
const r = local as Replay;
describe("recorded projection", () => {
  it("validates projected enum domains, finite measurements and journal ordering", () => {
    expect(["local", "cloud"]).toContain(r.mode);
    const sources = new Set([
      "measured",
      "injected",
      "derived",
      "provider",
      "simulated",
    ]);
    r.events.forEach((event, index) => {
      expect(event.seq).toBe(index + 1);
      expect(sources.has(event.source)).toBe(true);
      expect(Number.isFinite(Date.parse(event.at))).toBe(true);
      expect(event.hash).toMatch(/^[a-f0-9]{12}$/);
      if (index) expect(event.previous_hash).toBe(r.events[index - 1].hash);
    });
    r.losses.forEach((sample) => {
      expect(["worker log", "journal"]).toContain(sample.origin);
      expect(Number.isFinite(sample.loss)).toBe(true);
      expect(sample.loss).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(sample.step)).toBe(true);
    });
    expect(r.journal.count).toBe(r.events.length);
  });
  it("carries real optimizer continuity", () => {
    expect(r.recovery.verified_resumed).toBe(true);
    expect(r.losses.length).toBeGreaterThan(1);
    expect(r.recovery.resumed!.step).toBe(r.recovery.checkpoint!.step + 1);
  });
  it("has bounded deterministic handoff", () => {
    const b = handoff(r);
    expect(JSON.stringify(b)).toBe(JSON.stringify(handoff(r)));
    expect(
      Object.values(b).flat().join(" ").split(/\s+/).length,
    ).toBeLessThanOrEqual(120);
    expect(b.next).toContain("No physical fault");
  });
  it("derives ownership and checkpoint links", () => {
    expect(epochs(r).map((l) => l.epoch)).toEqual([1, 2]);
    expect(ledger(r).filter((e) => e.used)).toHaveLength(1);
    expect(beats(r).filter(Boolean)).toHaveLength(4);
    expect(relations(r).get(r.events[0].id)?.eventIds.has(r.events[1].id)).toBe(
      true,
    );
  });
  it("never animates on idle, backward or seek", () => {
    r.events.forEach((_, i) => {
      expect(topologyFrame(r, i).transition).toBeNull();
      expect(topologyFrame(r, i, i).transition).toBeNull();
      expect(topologyFrame(r, i, i + 1).transition).toBeNull();
    });
  });
  it("animates only qualified journal events", () => {
    r.events.forEach((e, i) => {
      const t = topologyFrame(r, i, i - 1).transition;
      if (e.kind === "WORKER_HEARTBEAT") expect(t).toBeNull();
      if (t) expect(t.eventId).toBe(e.id);
    });
    const i = r.events.findIndex((e) => e.kind === "LEASE_TRANSFERRED");
    expect(topologyFrame(r, i, i - 1).transition?.kind).toBe("baton");
  });
  it("shows unknown Pi rather than fabricated compute", () =>
    expect(
      topologyFrame(r, r.events.length - 1).nodes.find((n) => n.id === "pi")
        ?.source,
    ).toBe("no data"));
  it("filters without changing replay truth", () => {
    expect(
      r.events
        .filter((e) =>
          matches(e, { ...defaultFilters, scope: "all", source: "injected" }),
        )
        .every((e) => e.source === "injected"),
    ).toBe(true);
    expect(lossSegments(r.losses).length).toBeGreaterThanOrEqual(2);
  });
});
