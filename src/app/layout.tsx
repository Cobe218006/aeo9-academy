import "./globals.css";
import type { Metadata, Viewport } from "next";
export const metadata: Metadata = {
  title: "AEO 9 Academy | Corporate Curators",
  description: "Practical AI search, AEO, GEO, Amazon search and machine learning training with evidence hiring teams can check.",
  openGraph: { title: "AEO 9 Academy", description: "Training with checkable evidence: system-recorded progress, AI practice scores labeled as such, and human-verified credentials.", type: "website" },
};
export const viewport: Viewport = { themeColor: "#0A0A0A", colorScheme: "dark" };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
