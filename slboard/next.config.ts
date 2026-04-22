import type { NextConfig } from "next";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ESM/Vercel: __dirname ist hier nicht verfügbar (ReferenceError).
const configDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(configDir, "..");
/** Workspaces: `next` liegt oft im Monorepo-Root; Vercel (nur slboard) hat es unter slboard. */
const turbopackRoot = fs.existsSync(path.join(configDir, "node_modules", "next", "package.json"))
  ? configDir
  : fs.existsSync(path.join(repoRoot, "node_modules", "next", "package.json"))
    ? repoRoot
    : configDir;

const nextConfig: NextConfig = {
  turbopack: {
    root: turbopackRoot,
  },
  // PDF/Word-Parsing: native/Worker-Pfade — auf Vercel nicht mit Turbopack/Webpack bündeln,
  // sonst schlägt der Modul-Load fehl und die API liefert HTML statt JSON.
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist', 'mammoth'],
};

export default nextConfig;
