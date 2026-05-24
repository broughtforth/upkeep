import path from "node:path";
import type { NextConfig } from "next";

// Monorepo: dependencies are hoisted to the workspace root, so tell Turbopack
// to look two levels up. Mirrors apps/web/next.config.ts.
const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname, "..", ".."),
  },
};

export default nextConfig;
