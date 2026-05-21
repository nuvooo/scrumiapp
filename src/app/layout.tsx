import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scrumi",
  description: "Self-hosted Scrum analytics",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
