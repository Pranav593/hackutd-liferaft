"use client";
import { useSyncExternalStore } from "react";
let ids: ReadonlySet<string> | null = null;
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export function trace(next: ReadonlySet<string> | null) {
  ids = next;
  listeners.forEach((fn) => fn());
}
export function useRelated(id: string) {
  return useSyncExternalStore(
    subscribe,
    () => ids === null || ids.has(id),
    () => true,
  );
}
export function useTraceIds() {
  return useSyncExternalStore(
    subscribe,
    () => ids,
    () => null,
  );
}
