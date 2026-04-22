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
  // PDF/Word-Parsing: native/Worker-Pfade — auf Vercel nicht mit Turbopack/Webpack bündeln,
  // sonst schlägt der Modul-Load fehl und die API liefert HTML statt JSON.
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist', 'mammoth'],
};

export default nextConfig;
