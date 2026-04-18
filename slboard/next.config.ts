import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ESM/Vercel: __dirname ist hier nicht verfügbar (ReferenceError).
const configDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    // Erzwingt das Projekt-Root auf den Ordner "slboard"
    root: configDir,
  },
};

export default nextConfig;
