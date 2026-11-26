import path from "node:path";
import { env } from "@loom-web/env.mts";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Its badge sits over the sidebar's Site switcher
  devIndicators: false,
  // The pnpm workspace root. Without it Next guesses from whichever lockfile it finds first, which
  // can be one far above this repo (e.g. a stray lockfile in the home directory).
  turbopack: {
    root: path.join(__dirname, ".."),
  },
  // The admin API is proxied so the browser only ever talks to this origin. The session cookie rides
  // along on the rewrite, and the API's Set-Cookie comes back the same way — a second origin would
  // need cross-site cookies and a CORS policy to achieve the same thing.
  async rewrites() {
    return [
      {
        source: "/admin/:path*",
        destination: `${env.CMS_API_URL}/admin/:path*`,
      },
      // The MCP endpoint, so the address Settings → MCP shows is this origin's. Assistants send
      // their own token rather than a session cookie.
      {
        source: "/mcp",
        destination: `${env.CMS_API_URL}/mcp`,
      },
    ];
  },
};

export default nextConfig;
