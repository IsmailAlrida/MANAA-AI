/**
 * Fallback for /api/v1/* when no backend is configured.
 *
 * When MANAA_API_ORIGIN is set, next.config rewrites /api/v1/* to that backend
 * and the rewrite wins over this dynamic route. Without it, requests land here
 * and get a contract-shaped 503 instead of Next's HTML 404, so the UI can show
 * an "offline" state rather than a broken page.
 */
function unavailable() {
  return Response.json(
    {
      error: {
        code: "backend_unavailable",
        message:
          "No investigation backend is configured. Run `npm run dev -- --demo` or set MANAA_API_ORIGIN.",
      },
    },
    { status: 503, headers: { "Cache-Control": "no-store" } }
  )
}

export const GET = unavailable
export const POST = unavailable
export const PATCH = unavailable
