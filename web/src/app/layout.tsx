import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "LIFERAFT | Recovery cockpit",
  description: "Inspect checkpoint continuity, lease transfer and measured recovery evidence.",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>
}
