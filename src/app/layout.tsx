import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "AEO 9 Academy | Corporate Curators", description: "AI SEO, AEO, GEO, Amazon SEO, Python and machine learning academy." };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
