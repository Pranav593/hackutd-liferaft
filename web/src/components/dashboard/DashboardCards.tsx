"use client";
import type { Replay } from "../../lib/replay";
import { dashboardStory } from "../../lib/derive/dashboard";
import { beats } from "../../lib/derive/timeline";
import { Badge, Icon } from "../ui";
import { RouteGraphic, ProgressGraphic } from "./OverviewGraphics";
import type { DetailView } from "./DetailDialog";
function CardHead({ number, label }: { number: string; label: string }) {
  return (
    <div className="bento-label">
      <span>
        {number} / {label}
      </span>
      <span className="card-plus" aria-hidden="true">
        ↗
      </span>
    </div>
  );
}
export function DashboardCards({
  replay: r,
  cursor,
  loading,
  open,
}: {
  replay: Replay | null;
  cursor: number;
  loading: boolean;
  open: (view: DetailView) => void;
}) {
  const story = dashboardStory(r),
    sequence = beats(r),
    event = r?.events[cursor];
  return (
    <div className="dashboard-grid">
      <section className="bento bento-outcome" aria-labelledby="outcome-title">
        <CardHead number="01" label="THE OUTCOME" />
        <h2 id="outcome-title">
          {loading ? (
            <>
              Checking the
              <br />
              <em>story.</em>
            </>
          ) : story.verified ? (
            <>
              The work
              <br />
              <em>kept going.</em>
            </>
          ) : r ? (
            <>
              The result?
              <br />
              <em>Still unknown.</em>
            </>
          ) : (
            <>
              Every bit of
              <br />
              <em>work matters.</em>
            </>
          )}
        </h2>
        <p className="card-explanation">
          {loading
            ? "Reading and verifying the saved evidence."
            : story.explanation}
        </p>
        <div className="outcome-foot">
          <span className="result-mark">
            <span aria-hidden="true">{story.verified ? "✓" : "○"}</span>
            {story.verified ? "Recovery verified" : "Recovery not verified"}
          </span>
          <Badge source={r ? "derived" : "no data"} />
        </div>
        <button
          className="bento-hit"
          aria-label="Explore recovery proof"
          onClick={() => open("proof")}
        />
      </section>
      <section className="bento bento-route" aria-labelledby="route-title">
        <CardHead number="02" label="THE HANDOFF" />
        <div className="route-heading">
          <h2 id="route-title">
            A safer pair <em>of hands.</em>
          </h2>
          <span className="route-stamp">
            {event ? "AS OF REPLAY CURSOR" : "NO RECORD"}
          </span>
        </div>
        <RouteGraphic replay={r} cursor={cursor} />
        <div className="route-footer">
          <span>
            {r?.mode === "local"
              ? "Two programs on one computer."
              : "Only recorded worker roles are shown."}
          </span>
          <span>See who took over ↗</span>
        </div>
        <button
          className="bento-hit"
          aria-label="Explore workers and handoff"
          onClick={() => open("machines")}
        />
      </section>
      <section
        className="bento bento-incident"
        aria-labelledby="incident-title"
      >
        <CardHead number="03" label="THE TRIGGER" />
        <div className="alarm-symbol" aria-hidden="true">
          <Icon name="warning" size={44} />
        </div>
        <h2 id="incident-title">
          {r?.trigger?.source === "injected" ? (
            <>
              A practice
              <br />
              alarm.
              <br />
              <em>{story.verified ? "A real handoff." : "An open outcome."}</em>
            </>
          ) : (
            <>
              What started
              <br />
              <em>the rescue?</em>
            </>
          )}
        </h2>
        <p className="card-explanation">{story.incidentExplanation}</p>
        <Badge source={r?.trigger?.source ?? "no data"} />
        <ol className="mini-story">
          {["Alarm recorded", "Progress saved", "Backup continued"].map(
            (label, i) => (
              <li key={label}>
                <span
                  className={`story-dot ${sequence[i === 0 ? 0 : i === 1 ? 1 : 3] ? "recorded" : ""}`}
                  aria-hidden="true"
                />
                {sequence[i === 0 ? 0 : i === 1 ? 1 : 3]
                  ? label
                  : `${label} · unknown`}
              </li>
            ),
          )}
        </ol>
        <div className="incident-foot">
          <span>
            {r?.trigger?.source === "injected"
              ? "Practice, not overheating."
              : "Check the source."}
            <br />
            {r?.trigger?.source === "injected"
              ? "This was a labelled drill."
              : "Only recorded evidence counts."}
          </span>
          <span aria-hidden="true">↗</span>
        </div>
        <button
          className="bento-hit"
          aria-label="Explore the incident and event log"
          onClick={() => open("timeline")}
        />
      </section>
      <section
        className="bento bento-progress"
        aria-labelledby="progress-title"
      >
        <CardHead number="04" label="THE WORK" />
        <div className="progress-top">
          <h2 id="progress-title">
            {story.verified ? (
              <>
                Progress.
                <br />
                <em>Not a fresh start.</em>
              </>
            ) : (
              <>
                The work,
                <br />
                <em>as recorded.</em>
              </>
            )}
          </h2>
          <div className="saved-updates">
            <strong>{story.lost ?? "—"}</strong>
            <span>known updates lost</span>
            <Badge source={story.lost !== null ? "derived" : "no data"} />
          </div>
        </div>
        <ProgressGraphic replay={r} />
        <div className="progress-bottom">
          <span>
            {r?.losses.length === 1
              ? "One recorded measurement."
              : r?.losses.length
                ? "Real training measurements. Lower error is better."
                : "No training measurements attached."}
          </span>
          <Badge source={r?.losses.length ? "measured" : "no data"} />
        </div>
        <button
          className="bento-hit"
          aria-label="Explore training progress and checkpoints"
          onClick={() => open("progress")}
        />
      </section>
      <section className="bento bento-handoff" aria-labelledby="handoff-title">
        <CardHead number="05" label="THE NEXT PERSON" />
        <div className="handoff-top">
          <h2 id="handoff-title">
            Less guessing.
            <br />
            <em>A clearer handoff.</em>
          </h2>
          <svg
            className="note-graphic"
            aria-hidden="true"
            viewBox="0 0 108 122"
          >
            <path d="M16 9h64l15 16v87H16Z" fill="var(--frost)" />
            <path d="M80 9v19h15" fill="none" stroke="var(--navy)" />
            <path
              d="M30 44h49M30 55h49M30 66h31"
              stroke="var(--steel)"
              strokeWidth="3"
            />
            <circle cx="77" cy="95" r="17" fill="var(--honey)" />
            {story.verified ? (
              <path
                d="m68 95 6 6 11-13"
                fill="none"
                stroke="var(--navy)"
                strokeWidth="2"
              />
            ) : (
              <path d="M69 95h16" stroke="var(--navy)" strokeWidth="2" />
            )}
          </svg>
        </div>
        <p className="next-action">{story.next}</p>
        <div className="handoff-facts">
          <span>
            <i />A note you can copy or print
          </span>
          <span>
            <i />
            {r?.investigation
              ? "Saved advisory investigation attached"
              : "AI investigation: no data attached"}
          </span>
          <span>
            <i />
            Message delivery: no data attached
          </span>
        </div>
        <div className="handoff-card-foot">
          <span>Open the shift note ↗</span>
          <Badge source={r ? "derived" : "no data"} />
        </div>
        <button
          className="bento-hit"
          aria-label="Explore the handoff brief and investigation"
          onClick={() => open("handoff")}
        />
      </section>
    </div>
  );
}
