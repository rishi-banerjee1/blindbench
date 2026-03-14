/**
 * Shared CORS headers for all edge functions.
 * In production, restrict origin to your GitHub Pages domain.
 */
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Handle CORS preflight. Pass custom methods for GET-based endpoints.
 * Default: "POST, OPTIONS" (backward-compatible with all existing functions).
 */
export function handleCors(
  req: Request,
  methods = "POST, OPTIONS",
): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: { ...corsHeaders, "Access-Control-Allow-Methods": methods },
    });
  }
  return null;
}
