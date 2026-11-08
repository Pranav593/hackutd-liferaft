"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCockpit, update, select } from "../../lib/store/cockpit-store";
import { relationIndex } from "../ui/EvidenceTrace";
import { eventName, utc } from "../../lib/replay";
import { Badge, PanelTitle } from "../ui";
import { Copy } from "../ui/primitives";
const why: Record<string, string> = {
  CHECKPOINT_COMMITTED:
    "A verified snapshot of model and optimizer state the standby can resume from.",
  LEASE_TRANSFERRED:
    "Ownership moved to a new epoch. The old owner can no longer commit work.",
  FIRST_RESUMED_STEP_COMPLETED:
    "The first optimizer step measured on the new owner. This is the proof of recovery.",
  SENSOR_EVENT_RECEIVED:
    "A frame from the ESP32. Check its badge to see whether it was measured or injected.",
  RESCUE_REQUESTED: "The coordinator accepted a request to move the job.",
};
export function Inspector() {
  const r = useCockpit((s) => s.replay),
    id = useCockpit((s) => s.selectedId),
    open = useCockpit((s) => s.inspectorOpen);
  const e = r?.events.find((e) => e.id === id);
  const [mobile, setMobile] = useState(false);
  const sheet = useRef<HTMLElement>(null),
    opener = useRef<HTMLElement | null>(null),
    start = useRef<number | null>(null);
  const index = useMemo(() => relationIndex(r), [r]);
  useEffect(() => {
    const q = matchMedia("(max-width:899px)");
    setMobile(q.matches);
    const change = () => setMobile(q.matches);
    q.addEventListener("change", change);
    return () => q.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (!mobile || !open) return;
    opener.current = document.activeElement as HTMLElement;
    sheet.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const inert: [HTMLElement, boolean][] = [];
    let element: HTMLElement | null = sheet.current;
    while (element?.parentElement) {
      for (const sibling of element.parentElement.children) {
        if (
          sibling instanceof HTMLElement &&
          sibling !== element &&
          !sibling.classList.contains("sheet-backdrop")
        ) {
          inert.push([sibling, sibling.inert]);
          sibling.inert = true;
        }
      }
      element = element.parentElement;
      if (element === document.body) break;
    }
    return () => {
      document.body.style.overflow = before;
      inert.forEach(([element, value]) => {
        element.inert = value;
      });
      opener.current?.focus();
    };
  }, [mobile, open]);
  if (mobile && !open) return null;
  const close = () =>
    update({ inspectorOpen: false, ...(!mobile ? { selectedId: null } : {}) });
  return (
    <>
      {mobile && <div className="sheet-backdrop" onClick={close} />}
      <aside
        ref={sheet}
        className={`panel inspector ${mobile ? "sheet" : ""}`}
        role={mobile ? "dialog" : "region"}
        aria-modal={mobile ? true : undefined}
        aria-labelledby="inspector-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            close();
            return;
          }
          if (mobile && event.key === "Tab") {
            const focus = [
              ...sheet.current!.querySelectorAll<HTMLElement>(
                "button:not(:disabled),summary,a[href],input",
              ),
            ].filter((element) => {
              if (!element.getClientRects().length) return false;
              let ancestor = element.parentElement;
              while (ancestor && ancestor !== sheet.current) {
                if (
                  ancestor instanceof HTMLDetailsElement &&
                  !ancestor.open &&
                  !ancestor.querySelector(":scope > summary")?.contains(element)
                )
                  return false;
                ancestor = ancestor.parentElement;
              }
              return true;
            });
            const first = focus[0],
              last = focus.at(-1);
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        {mobile && (
          <div
            className="sheet-handle"
            onPointerDown={(e) => {
              start.current = e.clientY;
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerUp={(e) => {
              if (start.current != null && e.clientY - start.current > 60)
                close();
              start.current = null;
            }}
          >
            <span />
          </div>
        )}
        <div className="panel-title">
          <h2 id="inspector-title">Incident inspector</h2>
          <button
            aria-label="Close inspector"
            className="text-button"
            onClick={close}
          >
            ×
          </button>
        </div>
        {e ? (
          <>
            <p className="kicker">
              EVENT {e.seq} / {utc(e.at)}
            </p>
            <h3>{eventName(e.kind)}</h3>
            <p>
              {why[e.kind] ??
                "A recorded journal event. Only the attached evidence supports its status."}
            </p>
            <Badge source={e.source} />
            {e.source === "injected" && (
              <p className="warning">
                A software-injected drill. No physical fault is claimed.
              </p>
            )}
            <dl className="inspector-facts">
              <div>
                <dt>Worker</dt>
                <dd>{e.worker ?? "NO DATA"}</dd>
              </div>
              <div>
                <dt>Epoch / step</dt>
                <dd>
                  {e.epoch} / {e.step ?? "NO DATA"} <Badge source={e.source} />
                </dd>
              </div>
              {e.loss != null && (
                <div>
                  <dt>Loss</dt>
                  <dd>
                    {e.loss} <Badge source="measured" />
                  </dd>
                </div>
              )}
            </dl>
            <h4>
              Journal chain <Badge source="derived" />
            </h4>
            <p className="mono chain-hashes">
              {e.previous_hash.slice(0, 12)} → {e.hash.slice(0, 12)}
            </p>
            <p className="subtle">
              Only prefixes are included in this redacted projection. Full
              hashes remain server-side.
            </p>
            <div className="inline-actions">
              <Copy
                text={`${e.previous_hash} → ${e.hash}`}
                label="Copy prefixes"
              />
              <button
                className="text-button"
                disabled={!r?.events.find((x) => x.seq === e.seq - 1)}
                onClick={() => {
                  const prev = r?.events.find((x) => x.seq === e.seq - 1);
                  if (prev) select(prev.id);
                }}
              >
                ← Previous
              </button>
              <button
                className="text-button"
                disabled={!r?.events.find((x) => x.seq === e.seq + 1)}
                onClick={() => {
                  const next = r?.events.find((x) => x.seq === e.seq + 1);
                  if (next) select(next.id);
                }}
              >
                Next →
              </button>
            </div>
            <h4>Related evidence</h4>
            <div className="related-events">
              {[...(index?.get(e.id)?.eventIds ?? [])]
                .filter((id) => id !== e.id)
                .map((id) => {
                  const related = r?.events.find((x) => x.id === id);
                  return (
                    related && (
                      <button
                        key={id}
                        className="filter-chip"
                        onClick={() => select(id)}
                      >
                        Event {related.seq} ↗
                      </button>
                    )
                  );
                })}
            </div>
            <details>
              <summary>Evidence · redacted projection</summary>
              <pre>{JSON.stringify(e, null, 2)}</pre>
              <Copy text={JSON.stringify(e, null, 2)} label="Copy event" />
            </details>
          </>
        ) : (
          <p className="empty-state">
            Select a node, checkpoint, epoch or event to inspect its evidence.
          </p>
        )}
      </aside>
    </>
  );
}
