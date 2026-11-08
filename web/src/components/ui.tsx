import type { Source } from "../lib/contracts"

type IconName = "raft" | "radar" | "pulse" | "shield" | "arrow" | "cloud" | "laptop" | "chip" | "radio" | "stack" | "bolt" | "clock" | "chevron" | "message" | "spark" | "link"

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    raft: <><path d="m12 2 9 5v10l-9 5-9-5V7Z"/><path d="m3 7 9 5 9-5M12 12v10m-5-7 5-3 5 3"/></>,
    radar: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="m12 12 7-7"/></>,
    pulse: <path d="M2 12h5l3-7 4 14 3-7h5"/>,
    shield: <><path d="m12 22 2-1c4-2 6-5 6-9V5l-8-3-8 3v7c0 4 2 7 6 9Z"/><path d="m8 12 3 3 5-6"/></>,
    arrow: <path d="M3 12h17m-6-6 6 6-6 6"/>,
    cloud: <path d="M6 18a4 4 0 0 1-.7-8A6.5 6.5 0 0 1 18 9a4.5 4.5 0 0 1-.5 9Z"/>,
    laptop: <><rect x="5" y="4" width="14" height="12" rx="2"/><path d="m5 16-3 4h20l-3-4"/></>,
    chip: <><rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 3v3m6-3v3m-6 12v3m6-3v3M3 9h3m-3 6h3m12-6h3m-3 6h3"/></>,
    radio: <><path d="M12 12v8m-3 0h6M8 8a6 6 0 0 0 0 8m8-8a6 6 0 0 1 0 8M5 5a10 10 0 0 0 0 14m14-14a10 10 0 0 1 0 14"/><circle cx="12" cy="12" r="1"/></>,
    stack: <><path d="m12 3 10 5-10 5L2 8Zm-10 9 10 5 10-5m-20 4 10 5 10-5"/></>,
    bolt: <path d="m13 2-9 12h7l-1 8 10-13h-8Z"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    chevron: <path d="m9 6 6 6-6 6"/>,
    message: <path d="M21 5H3v13h5l4 4v-4h9ZM7 10h10M7 14h6"/>,
    spark: <path d="m12 2 2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6Z"/>,
    link: <><path d="M10 13l4-4m-6 7-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 1 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 0)"/></>,
  }
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

export function Badge({ source }: { source: Source | "no data" }) {
  return <span className={`badge ${source.replace(" ", "-")}`}><i />{source}</span>
}

export function PanelTitle({ icon, title, detail }: { icon: IconName; title: string; detail?: React.ReactNode }) {
  return <div className="panel-title"><h2><Icon name={icon} />{title}</h2>{detail}</div>
}
