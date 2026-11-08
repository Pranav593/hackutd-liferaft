"use client";
import { useState, type ReactNode } from "react";
export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty-state">{children}</p>;
}
export function Skeleton() {
  return (
    <div
      className="skeleton"
      role="status"
      aria-label="Checking saved evidence"
    >
      <span />
      <span />
      <span />
    </div>
  );
}
export function Copy({
  text,
  label = "Copy",
}: {
  text: string;
  label?: string;
}) {
  const [status, setStatus] = useState("");
  return (
    <>
      <button
        className="button small"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setStatus("Copied");
          } catch {
            setStatus("Clipboard unavailable. Select and copy the text.");
          }
        }}
      >
        {label}
      </button>
      <span role="status" className="copy-status">
        {status}
      </span>
    </>
  );
}
