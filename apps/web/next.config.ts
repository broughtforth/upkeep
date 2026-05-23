import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the workspace's shared package to be transpiled.
  transpilePackages: ["@upkeep/shared"],
  turbopack: {
    // Anchor Turbopack at the monorepo root so hoisted workspace deps
    // (@supabase/ssr, react-three/*, zustand peer deps) are reachable.
    // Convention files (src/proxy.ts, src/app/**) still resolve because
    // Next resolves them relative to the app dir, not turbopack.root.
    root: path.join(__dirname, "..", ".."),
  },
};

export default nextConfig;
