// =====================================================================
// SalonOS – public review submission (the link sent to clients after a
// completed appointment). verify_jwt=false: the client is not logged in.
//   GET  ?r=<reviewId>  -> { ok, already_submitted, client_name, salon }
//   POST { r, rating, comment } -> records the rating; if rating >= the
//        branch's gate threshold, returns the Google review URL so the
//        page can route the happy client to post it publicly.
// The review row is pre-created (with requested_at) when staff complete the
// appointment, so `r` is an existing id we only update.
// =====================================================================
import { corsHeaders, json } from "../_shared/cors.ts";
import { adminClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = adminClient();

  // branch context (single-salon: first branch)
  const { data: branch } = await supabase
    .from("branches")
    .select("name, google_review_url, review_gate_threshold")
    .order("created_at", { ascending: true }).limit(1).maybeSingle();
  const threshold = branch?.review_gate_threshold ?? 4;

  try {
    if (req.method === "GET") {
      const id = new URL(req.url).searchParams.get("r");
      if (!id) return json({ error: "missing review id" }, 400);
      const { data: rev } = await supabase
        .from("reviews").select("id, submitted_at, clients(full_name)").eq("id", id).maybeSingle();
      if (!rev) return json({ error: "not found" }, 404);
      return json({
        ok: true,
        already_submitted: !!rev.submitted_at,
        client_name: (rev.clients as { full_name?: string } | null)?.full_name ?? null,
        salon: branch?.name ?? "הסלון",
      });
    }

    if (req.method === "POST") {
      const { r, rating, comment } = await req.json();
      const rt = Number(rating);
      if (!r || !(rt >= 1 && rt <= 5)) return json({ error: "rating 1-5 required" }, 400);

      // only fill an unsubmitted review row (idempotent, anti-tamper)
      const { data: updated, error } = await supabase
        .from("reviews")
        .update({ rating: rt, comment: comment ?? null, submitted_at: new Date().toISOString() })
        .eq("id", r).is("submitted_at", null)
        .select("id").maybeSingle();
      if (error) throw error;

      const high = rt >= threshold;
      return json({
        ok: true,
        recorded: !!updated,
        high,
        google_url: high ? (branch?.google_review_url ?? null) : null,
      });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err) {
    console.error("submit-review error:", err);
    return json({ error: String(err) }, 500);
  }
});
