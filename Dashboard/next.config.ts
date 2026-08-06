import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Deploys run the self-contained .next/standalone bundle on the server
  // (built in CI — the ID server is too RAM-constrained to run next build).
  output: "standalone",
  turbopack: {
    root: path.join(__dirname),
  },
  // Dev-only: lets the LAN IP shown in "Network: http://<ip>:3000" load the
  // dev server (e.g. testing from a phone on the same Wi-Fi) without Next.js
  // blocking its HMR websocket as a cross-origin request.
  allowedDevOrigins: ["192.168.1.146"],
};

export default nextConfig;
