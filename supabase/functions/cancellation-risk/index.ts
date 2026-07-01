// =====================================================================
// SalonOS AI – Cancellation-risk engine (spec §4)
//   POST { appointment_id, weather_bad?, is_holiday? }
//   Computes a 0-100 risk score from client history, lead time, service
//   type, hour, day of week, distance, weather & holidays; writes a row
//   to cancellation_risks and recommends an action. For high risk on a
//   deposit-eligible service it also creates a pending deposit.
// =====================================================================
import { json, corsHeaders } from "../_shared/cors.ts";
import { adminClient } from "../_shared/supabase.ts";

function levelFor(score: number): "low" | "medium" | "high" {
  if (score >= 60) return "high";
  if (score >= 30) return "medium";
  return "low";
}

function actionFor(level: string, requiresDeposit: boolean): string {
  if (level === "high") {
    return requiresDeposit
      ? "דרוש מקדמה + שלח תזכורת נוספת ופתח מקום ברשימת המתנה"
      : "שיחת אישור + תזכורת נוספת והצעה לשינוי שעה במקום ביטול";
  }
  if (level === "medium") return "שלח תזכורת נוספת ובקש אישור הגעה";
  return "תזכורת רגילה";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { appointment_id, weather_bad = false, is_holiday = false } =
      await req.json();
    if (!appointment_id) return json({ error: "appointment_id required" }, 400);

    const supabase = adminClient();

    // load appointment + client + service info
    const { data: appt, error: apptErr } = await supabase
      .from("appointments")
      .select(
        "id, client_id, starts_at, booked_at, total_price, " +
          "clients(distance_km), " +
          "appointment_services(service_id, services(requires_deposit, deposit_amount))",
      )
      .eq("id", appointment_id)
      .single();
    if (apptErr) throw apptErr;

    // client cancellation history
    const { count: cancelCount } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("client_id", appt.client_id)
      .in("status", ["cancelled", "no_show"]);

    // ---- scoring ----
    let score = 0;
    const factors: Record<string, number> = {};

    // 1. cancellation history (up to 30)
    const histScore = Math.min((cancelCount ?? 0) * 10, 30);
    factors.history = histScore;
    score += histScore;

    // 2. lead time: booked far in advance => more likely to forget (up to 15)
    const start = new Date(appt.starts_at).getTime();
    const booked = new Date(appt.booked_at).getTime();
    const leadDays = Math.max((start - booked) / 86400000, 0);
    const leadScore = leadDays > 14 ? 15 : leadDays > 7 ? 10 : 0;
    factors.lead_time = leadScore;
    score += leadScore;

    // 3. hour of day & day of week
    const d = new Date(appt.starts_at);
    const hour = d.getUTCHours();
    const dow = d.getUTCDay(); // 0=Sun
    const hourScore = hour < 10 || hour >= 19 ? 8 : 0; // edge hours
    const dowScore = dow === 5 || dow === 6 ? 5 : 0; // weekend (Fri/Sat)
    factors.hour = hourScore;
    factors.day_of_week = dowScore;
    score += hourScore + dowScore;

    // 4. distance from salon (up to 12)
    const distance = appt.clients?.distance_km ?? 0;
    const distScore = distance > 20 ? 12 : distance > 10 ? 6 : 0;
    factors.distance = distScore;
    score += distScore;

    // 5. weather & holidays (external signals)
    const weatherScore = weather_bad ? 12 : 0;
    const holidayScore = is_holiday ? 8 : 0;
    factors.weather = weatherScore;
    factors.holiday = holidayScore;
    score += weatherScore + holidayScore;

    // 6. high-value services carry more no-show cost weight
    const svc = appt.appointment_services?.[0]?.services;
    const requiresDeposit = !!svc?.requires_deposit;
    const valueScore = (appt.total_price ?? 0) >= 500 ? 10 : 0;
    factors.service_value = valueScore;
    score += valueScore;

    score = Math.min(score, 100);
    const level = levelFor(score);
    const recommended = actionFor(level, requiresDeposit);

    // persist risk assessment
    const { data: risk, error: riskErr } = await supabase
      .from("cancellation_risks")
      .insert({
        appointment_id: appt.id,
        client_id: appt.client_id,
        score,
        level,
        factors,
        recommended_action: recommended,
      })
      .select("id")
      .single();
    if (riskErr) throw riskErr;

    // auto-create a pending deposit for high-risk deposit-eligible services
    let deposit_created = false;
    if (level === "high" && requiresDeposit && svc?.deposit_amount) {
      const { error: depErr } = await supabase.from("deposits").insert({
        appointment_id: appt.id,
        client_id: appt.client_id,
        amount: svc.deposit_amount,
        status: "pending",
      });
      if (!depErr) deposit_created = true;
    }

    return json({
      status: "ok",
      risk_id: risk.id,
      score,
      level,
      factors,
      recommended_action: recommended,
      deposit_created,
    });
  } catch (err) {
    console.error("cancellation-risk error:", err);
    return json({ error: String(err) }, 500);
  }
});
