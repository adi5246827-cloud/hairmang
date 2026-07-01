// =====================================================================
// SalonOS – send WhatsApp reminders for upcoming appointments.
// Default policy: remind about appointments happening TOMORROW (used by the
// cron that fires at 12:00 Asia/Jerusalem — i.e. noon the day before).
// Optional ?hours=N gives a rolling now..now+N window instead.
// Only confirmed/pending appointments with reminder_sent_at IS NULL are
// sent, then stamped (no double-send). JWT-protected. Runs in simulation
// mode until WhatsApp secrets are set.
// =====================================================================
import { corsHeaders, json } from "../_shared/cors.ts";
import { adminClient } from "../_shared/supabase.ts";
import { sendWhatsApp } from "../_shared/whatsapp.ts";

const TZ = "Asia/Jerusalem";
const fmt = (iso: string) =>
  new Date(iso).toLocaleString("he-IL", {
    weekday: "long", day: "numeric", month: "long",
    hour: "2-digit", minute: "2-digit", timeZone: TZ,
  });

/** UTC instant of a wall-clock time in `tz` on a given Y-M-D. */
function localToUTC(tz: string, ymd: string, hh = 0, mm = 0, ss = 0): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm, ss);
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(guess)).reduce((a: Record<string, string>, x) => (a[x.type] = x.value, a), {});
  const asLocal = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return new Date(guess - (asLocal - guess)); // subtract tz offset
}

/** [start,end] of the calendar day `dayOffset` days from today in `tz`. */
function tzDayRange(tz: string, dayOffset: number): { from: string; until: string; ymd: string } {
  const todayYmd = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  const base = new Date(todayYmd + "T00:00:00Z");
  base.setUTCDate(base.getUTCDate() + dayOffset);
  const ymd = base.toISOString().slice(0, 10);
  const start = localToUTC(tz, ymd, 0, 0, 0);
  const end = new Date(start.getTime() + 24 * 3600_000 - 1000);
  return { from: start.toISOString(), until: end.toISOString(), ymd };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const hoursParam = url.searchParams.get("hours");

    let from: string, until: string, window: string;
    if (hoursParam) {
      const hours = Math.min(168, Math.max(1, Number(hoursParam) || 24));
      const now = new Date();
      from = now.toISOString();
      until = new Date(now.getTime() + hours * 3600_000).toISOString();
      window = `next ${hours}h`;
    } else {
      const r = tzDayRange(TZ, 1); // tomorrow
      from = r.from; until = r.until; window = `tomorrow (${r.ymd})`;
    }

    const supabase = adminClient();
    const { data: appts, error } = await supabase
      .from("appointments")
      .select("id, starts_at, status, reminder_sent_at, clients(id, full_name, phone), appointment_services(services(name))")
      .gte("starts_at", from)
      .lte("starts_at", until)
      .in("status", ["confirmed", "pending"])
      .is("reminder_sent_at", null);
    if (error) throw error;

    let sent = 0, skipped = 0, simulated = false;
    for (const a of appts ?? []) {
      const client = a.clients as { id: string; full_name: string; phone: string | null } | null;
      if (!client?.phone) { skipped++; continue; }
      const svc = (a.appointment_services ?? [])
        .map((r: { services?: { name?: string } }) => r.services?.name).filter(Boolean).join(", ");
      const text = `תזכורת מהמספרה 💇 ${client.full_name}, מחכים לך ${svc ? "ל" + svc + " " : ""}ב${fmt(a.starts_at)}. לשינוי/ביטול השיבו להודעה זו.`;

      const res = await sendWhatsApp(client.phone, text);
      simulated = res.simulated;

      let { data: conv } = await supabase.from("conversations")
        .select("id").eq("client_id", client.id).eq("channel", "whatsapp").maybeSingle();
      if (!conv) {
        const { data: c } = await supabase.from("conversations")
          .insert({ client_id: client.id, channel: "whatsapp", external_id: client.phone })
          .select("id").single();
        conv = c;
      }
      if (conv) {
        await supabase.from("messages").insert({
          conversation_id: conv.id, direction: "outbound", body: text,
          intent: "reminder", sent_by_bot: true,
        });
      }
      await supabase.from("appointments")
        .update({ reminder_sent_at: new Date().toISOString() }).eq("id", a.id);
      sent++;
    }

    return json({ ok: true, sent, skipped, simulated, window });
  } catch (err) {
    console.error("send-reminders error:", err);
    return json({ error: String(err) }, 500);
  }
});
