import type { Replay } from "../src/lib/replay";
import local from "../fixtures/replay.local-job.json";

// JSON imports widen string literals; retain required fields and primitive types.
export type JsonShape<T> = T extends string
  ? string
  : T extends (infer U)[]
    ? JsonShape<U>[]
    : T extends object
      ? { [K in keyof T]: JsonShape<T[K]> }
      : T;
export const localReplay: JsonShape<Replay> = local;
