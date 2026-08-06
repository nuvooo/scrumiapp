import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Verifikations-Builds können per NEXT_DIST_DIR in ein eigenes Verzeichnis
  // bauen, ohne die .next-Chunks eines laufenden Dev-Servers zu überschreiben.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    // Backup-Import (/api/backup) schickt den kompletten Datenbestand als JSON —
    // das Default-Limit von 10 MB reicht dafür nicht.
    middlewareClientMaxBodySize: "200mb",
  },
};

export default nextConfig;
