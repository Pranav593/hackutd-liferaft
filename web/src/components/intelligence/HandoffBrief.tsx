"use client";
import { useMemo } from "react";
import { useCockpit } from "../../lib/store/cockpit-store";
import { handoff } from "../../lib/derive/handoff";
import { Copy } from "../ui/primitives";
import { Badge } from "../ui";
export function HandoffBrief() {
  const r = useCockpit((s) => s.replay);
  const b = useMemo(() => handoff(r), [r]);
  const lines = [
    ["What happened", b.happened],
    ["Verified", b.verified],
    ["Unknown", b.unknown.join(" ")],
    ["Next action", b.next],
  ];
  const title = `HANDOFF BRIEF · ${r?.job ?? "no journal"} · saved replay`,
    text = [
      title,
      ...lines.map(([label, value]) => `${label.toUpperCase()}\n${value}`),
    ].join("\n\n"),
    markdown = [
      `# ${title}`,
      ...lines.map(([label, value]) => `**${label}**\n${value}`),
    ].join("\n\n");
  return (
    <section className="handoff" id="handoff">
      <div className="handoff-header">
        <span className="kicker">SHIFT NOTE / SAVED REPLAY</span>
        <span aria-hidden="true">↗</span>
      </div>
      <h2>
        Handoff <em>brief.</em>
      </h2>
      <p className="mono">{r?.job ?? "No journal selected"}</p>
      <Badge source={r ? "derived" : "no data"} />
      <dl>
        {lines.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {r?.investigation&&<p className="handoff-advisory"><Badge source="provider"/> Nemotron (advisory): {r.investigation.outcome}</p>}
      <div className="inline-actions no-print">
        <Copy text={text} label="Copy text" />
        <Copy text={markdown} label="Copy Markdown" />
        <button className="button small" onClick={() => window.print()}>
          Print
        </button>
      </div>
    </section>
  );
}
