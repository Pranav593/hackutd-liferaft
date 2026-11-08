"use client";
import { useState } from "react";
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
