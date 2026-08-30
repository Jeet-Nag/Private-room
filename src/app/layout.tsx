import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PHANTOM ROOM — Private Real-Time Communication",
  description: "Production-grade, privacy-first, room-based real-time communication. Zero phone numbers, zero registration, ephemeral auto-destroying rooms with client-side E2EE.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#08090C",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-slate-100 antialiased selection:bg-phantom-cyan selection:text-phantom-dark">
        {children}
      </body>
    </html>
  );
}
