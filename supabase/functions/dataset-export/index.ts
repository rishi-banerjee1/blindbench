/**
 * dataset-export Edge Function
 *
 * GET endpoint that exports evaluation records as JSON or CSV.
 * Queries the evaluation_records view with optional filters.
 *
 * Query params:
 *   format: "json" (default) or "csv"
 *   limit: max rows (default 100, max 1000)
 *   offset: pagination offset (default 0)
 *   model: filter by model identifier
 *   failure_type: filter by failure type
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

const MAX_LIMIT = 1000;
const DEFAULT_LIMIT = 100;

serve(async (req: Request) => {
  // Support GET for this endpoint
  const corsResponse = handleCors(req, "GET, OPTIONS");
  if (corsResponse) return corsResponse;

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const format = url.searchParams.get("format") || "json";
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
      MAX_LIMIT,
    );
    const offset = parseInt(url.searchParams.get("offset") || "0", 10) || 0;
    const modelFilter = url.searchParams.get("model");
    const failureFilter = url.searchParams.get("failure_type");

    if (format !== "json" && format !== "csv") {
      return new Response(
        JSON.stringify({ error: 'Invalid format. Use "json" or "csv".' }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Build query
    let query = supabase
      .from("evaluation_records")
      .select(
        "prompt_id, prompt_text, model, response_text, truth_score, failure_type, stability_score, total_votes, votes_won, won_vote, prompt_created_at",
      )
      .range(offset, offset + limit - 1);

    if (modelFilter) {
      query = query.eq("model", modelFilter);
    }
    if (failureFilter) {
      query = query.eq("failure_type", failureFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Dataset export query failed:", error.message);
      return new Response(
        JSON.stringify({ error: "Failed to fetch evaluation records." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const records = data || [];

    if (format === "csv") {
      const csv = toCSV(records);
      return new Response(csv, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="blindbench_export.csv"',
        },
      });
    }

    return new Response(JSON.stringify(records), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unhandled error in dataset-export:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

/**
 * Convert records array to CSV string.
 * Properly escapes fields containing commas, quotes, or newlines.
 */
function toCSV(
  records: Array<Record<string, unknown>>,
): string {
  if (records.length === 0) return "";

  const headers = [
    "prompt_id",
    "prompt_text",
    "model",
    "response_text",
    "truth_score",
    "failure_type",
    "stability_score",
    "total_votes",
    "votes_won",
    "won_vote",
    "prompt_created_at",
  ];

  const escapeField = (value: unknown): string => {
    const str = value === null || value === undefined ? "" : String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [headers.join(",")];
  for (const record of records) {
    const row = headers.map((h) => escapeField(record[h]));
    lines.push(row.join(","));
  }

  return lines.join("\n");
}
