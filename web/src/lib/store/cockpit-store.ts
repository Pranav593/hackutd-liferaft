"use client";
import { useSyncExternalStore } from "react";
import type { Replay } from "../replay";
import { defaultFilters, type Filters } from "../derive/timeline";

export type State = {
  replay: Replay | null;
  status: "idle" | "loading" | "ready" | "error";
  error: string;
  cursor: number;
  previous: number;
  selectedId: string | null;
  playing: boolean;
  speed: number;
  filters: Filters;
  inspectorOpen: boolean;
  topologyMode: "2d" | "3d";
  motion: "system" | "reduced" | "full";
  quality: "auto" | "high" | "mid" | "low";
  camera: string | null;
};
const initial: State = {
  replay: null,
  status: "idle",
  error: "",
  cursor: -1,
  previous: -2,
  selectedId: null,
  playing: false,
  speed: 1,
  filters: defaultFilters,
  inspectorOpen: false,
  topologyMode: "3d",
  motion: "system",
  quality: "auto",
  camera: null,
};
let state = initial;
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export function update(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}
export function useCockpit<T>(selector: (state: State) => T) {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(initial),
  );
}
export function select(id: string, open = true) {
  const index = state.replay?.events.findIndex((e) => e.id === id) ?? -1;
  if (index < 0) return;
  update({
    selectedId: id,
    cursor: index,
    previous: -2,
    inspectorOpen: open,
    playing: false,
  });
}
export function setCursor(index: number, continuous = false) {
  const n = state.replay?.events.length ?? 0;
  if (!n) return;
  const cursor = Math.max(0, Math.min(n - 1, index));
  update({
    cursor,
    previous: continuous ? state.cursor : -2,
    selectedId: state.replay!.events[cursor].id,
    ...(!continuous ? { playing: false } : {}),
  });
}
export function step(delta: number, milestone = false) {
  let i = state.cursor + delta;
  if (milestone) {
    const events = state.replay?.events ?? [];
    while (
      i > 0 &&
      i < events.length - 1 &&
      !/JOB_|RESCUE_|SELECTED|TRANSFERRED|FIRST_RESUMED|YIELDED|SENSOR_/.test(
        events[i].kind,
      )
    )
      i += delta;
  }
  setCursor(i, true);
}
let request: AbortController | null = null;
export async function load() {
  request?.abort();
  const active = new AbortController();
  request = active;
  let timedOut = false;
  const deadline = setTimeout(() => {
    timedOut = true;
    active.abort();
  }, 8000);
  update({ status: "loading", error: "", playing: false });
  try {
    const response = await fetch("/api/replay", {
      cache: "no-store",
      signal: active.signal,
    });
    if (!response.ok)
      throw new Error(
        response.status === 403
          ? "The cockpit only serves replay data on this machine."
          : response.status === 422
            ? "Saved evidence is unavailable or failed verification."
            : "Couldn't reach the local console.",
      );
    const data = (await response.json()) as { replay: Replay | null };
    if (active.signal.aborted) return;
    const replay = data.replay;
    const params = new URLSearchParams(location.search);
    const preferred = state.selectedId ?? params.get("e");
    const selectedId =
      replay?.events.find((e) => e.id === preferred)?.id ??
      replay?.recovery.evidence_event_ids.at(-1) ??
      replay?.trigger?.id ??
      null;
    const urlCursor = params.get("c");
    const c =
      urlCursor !== null && /^\d+$/.test(urlCursor) ? Number(urlCursor) : null;
    const cursor = replay
      ? Math.min(
          replay.events.length - 1,
          Math.max(
            0,
            state.replay?.job === replay.job
              ? state.cursor
              : (c ??
                  (preferred && replay.events.some((e) => e.id === preferred)
                    ? replay.events.findIndex((e) => e.id === preferred)
                    : replay.events.length - 1)),
          ),
        )
      : -1;
    update({
      replay,
      status: "ready",
      selectedId,
      cursor,
      previous: -2,
      ...(!state.replay
        ? {
            topologyMode: ["off", "2d"].includes(params.get("gl") ?? "")
              ? "2d"
              : "3d",
            filters: {
              ...defaultFilters,
              scope: params.get("f") === "all" ? "all" : "milestones",
            },
          }
        : {}),
    });
  } catch (error) {
    if (request === active && (!active.signal.aborted || timedOut))
      update({
        replay: null,
        status: "error",
        error:
          timedOut || error instanceof TypeError
            ? "Couldn't reach the local console."
            : error instanceof Error
              ? error.message
              : "Couldn't reach the local console.",
        cursor: -1,
        selectedId: null,
      });
  } finally {
    clearTimeout(deadline);
  }
}
export function syncUrl() {
  if (state.status !== "ready" || !state.replay) return;
  const u = new URL(location.href);
  if (state.selectedId) u.searchParams.set("e", state.selectedId);
  u.searchParams.set("c", String(state.cursor));
  u.searchParams.set("f", state.filters.scope);
  if (!["lose", "leak-check"].includes(u.searchParams.get("gl") ?? ""))
    u.searchParams.set("gl", state.topologyMode);
  history.replaceState(null, "", u);
}
