import type { NextConfig } from "next"

/**
 * The browser always talks to same-origin /api/v1/* (cookie auth + native
 * EventSource). MANAA_API_ORIGIN selects the backend — demo or real — so the
 * frontend never branches on which one it is. Server-side only; not NEXT_PUBLIC.
 */
// In development it defaults to the local demo backend (apps/demo-api), which
// `npm run dev` starts alongside the web app. Production has no default.
const DEV_DEFAULT_API_ORIGIN = "http://127.0.0.1:4787"
const apiOrigin =
  process.env.MANAA_API_ORIGIN ||
  (process.env.NODE_ENV === "production" ? undefined : DEV_DEFAULT_API_ORIGIN)

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui"],
  // Next's gzip buffers proxied Server-Sent Events, so the browser would see no
  // run progress until the stream ends. Compression belongs to the reverse proxy.
  compress: false,
  async rewrites() {
    if (!apiOrigin) return []
    return [{ source: "/api/v1/:path*", destination: `${apiOrigin.replace(/\/$/, "")}/api/v1/:path*` }]
  },
}

export default nextConfig
