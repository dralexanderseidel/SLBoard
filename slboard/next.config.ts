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
  // pdfjs: Worker/Fonts nur für Routen einbinden, die pdf-parse/pdfjs laden (kleinere Serverless-Traces).
  outputFileTracingIncludes: Object.fromEntries(
    [
      "/api/documents/[id]/extract-text",
      "/api/documents/[id]/version",
      "/api/documents/[id]/steering-analysis",
      "/api/documents/[id]/steering-todos",
      "/api/upload",
      "/api/summarize",
      "/api/summarize-batch",
      "/api/ai/query",
      "/api/ai/drafts/document",
      "/api/ai/drafts/parent-letter",
      "/api/admin/reindex",
    ].map((route) => [
      route,
      [
        "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
        "./node_modules/pdf-parse/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
        "./node_modules/pdfjs-dist/standard_fonts/**/*",
        "./node_modules/pdf-parse/node_modules/pdfjs-dist/standard_fonts/**/*",
      ],
    ])
  ),
};

export default nextConfig;
