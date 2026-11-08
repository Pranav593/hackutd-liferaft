import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

export const metadata: Metadata = {
  title: "LIFERAFT | Recovery cockpit",
  description:
    "Inspect checkpoint continuity, lease transfer and measured recovery evidence.",
};
const sans = localFont({
  src: "../fonts/geist.woff2",
  variable: "--font-geist",
  display: "swap",
});
const mono = localFont({
  src: "../fonts/geist-mono.woff2",
  variable: "--font-geist-mono",
  display: "swap",
});
const serif = localFont({
  src: "../fonts/instrument-serif.woff2",
  variable: "--font-instrument",
  style: "italic",
  display: "swap",
});
export const viewport: Viewport = { themeColor: "#F1FAEE" };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} ${serif.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
