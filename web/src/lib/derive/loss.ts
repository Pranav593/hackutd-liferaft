import type { LossSample, Replay } from "../replay";
export function lossSegments(samples: LossSample[]) {
  const segments: LossSample[][] = [];
  for (const s of samples) {
    const last = segments.at(-1)?.at(-1);
    if (
      !last ||
      last.worker !== s.worker ||
      last.epoch !== s.epoch ||
      last.step + 1 !== s.step
    )
      segments.push([]);
    segments.at(-1)!.push(s);
  }
  return segments;
}
export function nearestEvent(r: Replay, sample: LossSample) {
  return (
    r.events
      .filter(
        (e) =>
          e.worker === sample.worker &&
          e.epoch === sample.epoch &&
          e.step != null,
      )
      .sort(
        (a, b) =>
          Math.abs(a.step! - sample.step) - Math.abs(b.step! - sample.step),
      )[0] ?? null
  );
}
export function decimate(
  samples: LossSample[],
  width: number,
  keepStep?: number,
) {
  if (samples.length <= width * 2) return samples;
  const bucketSize = Math.ceil(samples.length / width),
    result: LossSample[] = [];
  for (let i = 0; i < samples.length; i += bucketSize) {
    const b = samples.slice(i, i + bucketSize);
    const chosen = new Set([
      b[0],
      b.at(-1)!,
      b.reduce((a, c) => (a.loss < c.loss ? a : c)),
      b.reduce((a, c) => (a.loss > c.loss ? a : c)),
      ...b.filter((s) => s.step === keepStep),
    ]);
    result.push(...b.filter((s) => chosen.has(s)));
  }
  return result;
}
