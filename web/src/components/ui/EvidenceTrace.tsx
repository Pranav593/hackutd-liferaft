"use client";
import { useMemo, type ReactNode } from "react";
import { useCockpit } from "../../lib/store/cockpit-store";
import { useRelated, trace } from "../../lib/store/hover-store";
import { relations } from "../../lib/derive/relations";
import type { Replay } from "../../lib/replay";
const cached = new WeakMap<Replay, ReturnType<typeof relations>>();
export function relationIndex(r: Replay | null) {
  if (!r) return null;
  let index = cached.get(r);
  if (!index) {
    index = relations(r);
    cached.set(r, index);
  }
  return index;
}
export function EvidenceTrace({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  const r = useCockpit((s) => s.replay),
    related = useRelated(id);
  const index = useMemo(() => relationIndex(r), [r]);
  return (
    <div
      className={`evidence-trace ${related ? "related" : "unrelated"}`}
      onMouseEnter={() => trace(index?.get(id)?.eventIds ?? new Set([id]))}
      onMouseLeave={() => trace(null)}
      onFocus={() => trace(index?.get(id)?.eventIds ?? new Set([id]))}
      onBlur={() => trace(null)}
    >
      {children}
    </div>
  );
}
