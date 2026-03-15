import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Erzwingt das Projekt-Root auf den Ordner "slboard"
    root: __dirname,
  },
};

export default nextConfig;
