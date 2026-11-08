"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { useCockpit, update } from "../../lib/store/cockpit-store";
import { eventName, utc } from "../../lib/replay";
import { RecoveryProof } from "../proof/RecoveryProof";
import { TopologyStage } from "../topology/TopologyStage";
import { OwnershipEpochs } from "../training/OwnershipEpochs";
import { LossChart } from "../training/LossChart";
import { CheckpointLedger } from "../training/CheckpointLedger";
import { FlightRecorder } from "../recorder/FlightRecorder";
import { HandoffBrief } from "../intelligence/HandoffBrief";
import { NemotronEvidence } from "../intelligence/NemotronEvidence";
import {
  OperatorComms,
  Readiness,
  SensorEvidence,
} from "../operators/OperatorEvidence";
import { Badge } from "../ui";
import { Copy } from "../ui/primitives";

export type DetailView =
  | "proof"
  | "machines"
  | "timeline"
  | "progress"
  | "handoff"
  | "devices";
const views: { id: DetailView; name: string; title: string; intro: string }[] =
  [
    {
      id: "proof",
      name: "Proof",
      title: "How do we know it worked?",
      intro:
        "The record must show saved progress, a handoff, and a real update completed by the backup. A success message by itself is not enough.",
    },
    {
      id: "machines",
      name: "Workers",
      title: "Who did the work?",
      intro:
        "A worker is the program doing the training. The control desk makes sure only one worker owns the job at a time. This view follows the replay position.",
    },
    {
      id: "timeline",
      name: "Event log",
      title: "What happened, in order?",
      intro:
        "Each row is a saved event. Select a row to see its source and supporting record. “Injected” means a practice alarm, not real overheating.",
    },
    {
      id: "progress",
      name: "Training",
      title: "What progress was saved?",
      intro:
        "An update is one piece of training work. A checkpoint saves the model, its learning state, and where it stopped. Lower loss means smaller prediction errors.",
    },
    {
      id: "handoff",
      name: "Handoff",
      title: "What should the next person know?",
      intro:
        "The shift note comes from the verified record. Nemotron’s investigation is advisory and cannot change the recovery result.",
    },
    {
      id: "devices",
      name: "Devices & messages",
      title: "What else was observed?",
      intro:
        "Temperatures, message delivery, acknowledgements, and live readiness need their own evidence. Missing data stays unknown.",
    },
  ];
function SelectedEvidence() {
  const r = useCockpit((s) => s.replay),
    id = useCockpit((s) => s.selectedId),
    e = r?.events.find((e) => e.id === id);
  return (
    <section
      className="panel selected-evidence"
      aria-label="Selected event evidence"
    >
      <h3>Inside the selected event</h3>
      {e ? (
        <>
          <p className="kicker">
            EVENT {e.seq} · {utc(e.at)}
          </p>
          <h4>{eventName(e.kind)}</h4>
          <Badge source={e.source} />
          <dl className="inspector-facts">
            <div>
              <dt>Worker</dt>
              <dd>{e.worker ?? "Not recorded"}</dd>
            </div>
            <div>
              <dt>Ownership epoch</dt>
              <dd>
                {e.epoch} <Badge source="derived" />
              </dd>
            </div>
            <div>
              <dt>Update</dt>
              <dd>{e.step ?? "Not recorded"}</dd>
            </div>
          </dl>
          <p className="chain-hashes">
            <code>
              {e.previous_hash} → {e.hash}
            </code>
          </p>
          <p className="subtle">
            These are hash prefixes. Full fingerprints remain on the server.
          </p>
          <details>
            <summary>Open the technical record (JSON)</summary>
            <pre>{JSON.stringify(e, null, 2)}</pre>
            <Copy text={JSON.stringify(e, null, 2)} label="Copy event" />
          </details>
        </>
      ) : (
        <p>Select an event to inspect the original redacted record.</p>
      )}
    </section>
  );
}
export function DetailDialog({
  view,
  onView,
  onClose,
}: {
  view: DetailView | null;
  onView: (view: DetailView) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (view && !dialog.current?.open) {
      opener.current = document.activeElement as HTMLElement;
      dialog.current?.showModal();
    } else if (!view && dialog.current?.open) dialog.current.close();
  }, [view]);
  const active = views.find((v) => v.id === view) ?? views[0];
  const close = () => {
    dialog.current?.close();
  };
  let content: ReactNode = null;
  if (view === "proof")
    content = (
      <div className="detail-grid">
        <RecoveryProof />
        <div>
          <OwnershipEpochs />
          <CheckpointLedger />
        </div>
      </div>
    );
  if (view === "machines")
    content = (
      <>
        <TopologyStage />
        <OwnershipEpochs />
      </>
    );
  if (view === "timeline")
    content = (
      <div className="detail-grid">
        <FlightRecorder />
        <SelectedEvidence />
      </div>
    );
  if (view === "progress")
    content = (
      <>
        <LossChart />
        <CheckpointLedger />
      </>
    );
  if (view === "handoff")
    content = (
      <div className="detail-grid">
        <HandoffBrief />
        <NemotronEvidence />
      </div>
    );
  if (view === "devices")
    content = (
      <div className="detail-device-grid">
        <SensorEvidence />
        <OperatorComms />
        <Readiness />
      </div>
    );
  return (
    <dialog
      ref={dialog}
      className="detail-dialog"
      aria-labelledby="detail-title"
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const elements = [
          ...dialog.current!.querySelectorAll<HTMLElement>(
            'button:not(:disabled),a[href],input:not(:disabled),select,textarea,summary,[tabindex="0"]',
          ),
        ].filter((element) => {
          if (!element.getClientRects().length) return false;
          let parent = element.parentElement;
          while (parent && parent !== dialog.current) {
            if (
              parent instanceof HTMLDetailsElement &&
              !parent.open &&
              !parent.querySelector(":scope > summary")?.contains(element)
            )
              return false;
            parent = parent.parentElement;
          }
          return true;
        });
        const first = elements[0],
          last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onClose={() => {
        update({ inspectorOpen: false });
        onClose();
        opener.current?.focus();
      }}
      onClick={(e) => {
        if (e.target === dialog.current) {
          const bounds = dialog.current.getBoundingClientRect();
          if (
            e.clientX < bounds.left ||
            e.clientX > bounds.right ||
            e.clientY < bounds.top ||
            e.clientY > bounds.bottom
          )
            close();
        }
      }}
    >
      <div className="detail-top">
        <span className="kicker">LIFERAFT / A CLOSER LOOK</span>
        <button
          className="detail-close"
          onClick={close}
          aria-label="Close details"
        >
          Close <span aria-hidden="true">×</span>
        </button>
      </div>
      <nav className="detail-tabs" aria-label="Evidence categories">
        {views.map((v) => (
          <button
            key={v.id}
            aria-current={view === v.id ? "page" : undefined}
            onClick={() => onView(v.id)}
          >
            {v.name}
          </button>
        ))}
      </nav>
      <div className="detail-scroll">
        <header className="detail-intro">
          <h2 id="detail-title">{active.title}</h2>
          <p>{active.intro}</p>
        </header>
        {content}
        <details className="glossary">
          <summary>A few technical words, in plain English</summary>
          <dl>
            <div>
              <dt>Checkpoint</dt>
              <dd>
                A saved place in the work, including everything needed to
                continue learning.
              </dd>
            </div>
            <div>
              <dt>Hash</dt>
              <dd>
                A digital fingerprint used to check that a saved file has not
                changed.
              </dd>
            </div>
            <div>
              <dt>Epoch / lease</dt>
              <dd>
                An ownership version and a time-limited permission to work. They
                help stop two workers from acting as the owner.
              </dd>
            </div>
            <div>
              <dt>Loss</dt>
              <dd>
                The model’s prediction error, measured during real training.
              </dd>
            </div>
            <div>
              <dt>Replay</dt>
              <dd>
                A saved account of a past run. It does not show what devices are
                doing right now.
              </dd>
            </div>
          </dl>
        </details>
      </div>
    </dialog>
  );
}
