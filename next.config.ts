import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    // Backup-Import (/api/backup) schickt den kompletten Datenbestand als JSON —
    // das Default-Limit von 10 MB reicht dafür nicht.
    middlewareClientMaxBodySize: "200mb",
  },
};

export default nextConfig;
