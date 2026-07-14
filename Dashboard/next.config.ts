import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Deploys run the self-contained .next/standalone bundle on the server
  // (built in CI — the ID server is too RAM-constrained to run next build).
  output: "standalone",
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
