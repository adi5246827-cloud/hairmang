// =====================================================================
// SalonOS AI – Public booking endpoint (powers the booking frontend)
//   GET                         -> { services, staff }
//   GET ?slots=1&date&service_id[&staff_id]
//                               -> { slots: [ISO,...] } real availability
//   POST { full_name, phone, email?, service_id, staff_id?, desired_time }
//                               -> create client + pending appointment
// Public (verify_jwt = false); all writes via service-role so the DB
// stays locked behind RLS.
// =====================================================================
import { corsHeaders, json } from "../_shared/cors.ts";
import { adminClient } from "../_shared/supabase.ts";
import { applyPricing, localDowMinutes } from "../_shared/pricing.ts";

const TZ = "Asia/Jerusalem";
const SLOT_STEP_MIN = 30;
// Fallback opening hours per weekday (0=Sun … 6=Sat), local time. null = closed.
// Used only when the business_hours table has no row for that day/branch.
const DEFAULT_HOURS: Record<number, [number, number] | null> = {
  0: [9, 20], 1: [9, 20], 2: [9, 20], 3: [9, 20], 4: [9, 20],
  5: [9, 14], // Friday
  6: null,    // Saturday closed
};

// "HH:MM[:SS]" -> minutes since midnight
function hmToMin(t: string): number {
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + (m || 0);
}

// Resolve a day's [openMin, closeMin] from business_hours, else DEFAULT_HOURS.
// Returns null when the salon is closed that day.
async function dayHoursMin(
  supabase: any, branchId: string | undefined, dow: number,
): Promise<[number, number] | null> {
  const { data } = await supabase
    .from("business_hours")
    .select("open_time, close_time, is_closed")
    .eq("branch_id", branchId)
    .eq("day_of_week", dow)
    .maybeSingle();
  if (data) {
    return data.is_closed ? null : [hmToMin(data.open_time), hmToMin(data.close_time)];
  }
  const def = DEFAULT_HOURS[dow];
  return def ? [def[0] * 60, def[1] * 60] : null;
}

// Recurring staff breaks for a weekday (day_of_week null = every day).
async function loadBreaks(supabase: any, dow: number) {
  const { data } = await supabase
    .from("staff_breaks")
    .select("staff_id, start_time, end_time, day_of_week");
  return (data ?? []).filter((b: any) => b.day_of_week == null || b.day_of_week === dow);
}

// Per-stylist working hours for a weekday -> { [staffId]: {start_time,end_time,is_off} }.
async function loadStaffHours(supabase: any, dow: number) {
  const { data } = await supabase
    .from("staff_hours")
    .select("staff_id, start_time, end_time, is_off, day_of_week")
    .eq("day_of_week", dow);
  const map: Record<string, any> = {};
  (data ?? []).forEach((r: any) => (map[r.staff_id] = r));
  return map;
}

// offset (ms) of a timezone at a given instant
function tzOffsetMs(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value;
  const asUTC = Date.UTC(
    +p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second,
  );
  return asUTC - date.getTime();
}

// convert a local wall-clock time (in TZ) to a UTC Date
function localToUTC(y: number, m: number, d: number, hh: number, mm: number): Date {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off = tzOffsetMs(new Date(guess), TZ);
  return new Date(guess - off);
}

const overlaps = (aS: number, aE: number, bS: number, bE: number) =>
  aS < bE && bS < aE;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = adminClient();
  const url = new URL(req.url);

  // ----- GET -----
  if (req.method === "GET") {
    // availability query
    if (url.searchParams.get("slots")) {
      return await getSlots(supabase, url);
    }
    // form metadata: services + staff
    const [{ data: services }, { data: staff }] = await Promise.all([
      supabase.from("services")
        .select("id, name, duration_minutes, base_price")
        .eq("is_active", true).order("name"),
      supabase.from("staff")
        .select("id, full_name")
        .eq("is_active", true).order("full_name"),
    ]);
    return json({ services: services ?? [], staff: staff ?? [] });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // ----- POST: create booking -----
  try {
    const body = await req.json();
    const full_name = String(body.full_name ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const email = body.email ? String(body.email).trim() : null;
    const service_id = body.service_id;
    const staff_id = body.staff_id || null;
    const desired_time = body.desired_time;

    if (!full_name) return json({ error: "נא להזין שם מלא" }, 400);
    if (!phone) return json({ error: "נא להזין מספר טלפון" }, 400);
    if (!service_id) return json({ error: "נא לבחור סוג טיפול" }, 400);
    if (!desired_time) return json({ error: "נא לבחור שעה פנויה" }, 400);

    const start = new Date(desired_time);
    if (isNaN(start.getTime())) return json({ error: "תאריך לא תקין" }, 400);
    if (start.getTime() < Date.now()) {
      return json({ error: "לא ניתן לקבוע תור בעבר" }, 400);
    }

    const { data: service, error: svcErr } = await supabase
      .from("services")
      .select("id, name, duration_minutes, base_price")
      .eq("id", service_id).eq("is_active", true).single();
    if (svcErr || !service) return json({ error: "טיפול לא נמצא" }, 400);

    const end = new Date(start.getTime() + service.duration_minutes * 60000);

    const { data: branch } = await supabase
      .from("branches").select("id").order("created_at").limit(1).maybeSingle();

    // re-check the slot is still free (avoid double-booking races)
    const free = await slotIsFree(
      supabase, branch?.id, start, end, staff_id,
    );
    if (!free) return json({ error: "השעה נתפסה, אנא בחרו שעה אחרת" }, 409);

    // ----- hard block: salon must be open for the whole appointment window -----
    const { dow, minutes } = localDowMinutes(start, TZ);
    const eMin = minutes + service.duration_minutes;
    const salonHours = await dayHoursMin(supabase, branch?.id, dow);
    if (!salonHours || minutes < salonHours[0] || eMin > salonHours[1]) {
      return json({ error: "המספרה סגורה בשעה זו, בחרו שעה אחרת" }, 409);
    }

    // ----- assign a stylist: respect working hours + breaks, never double-book -----
    // (done before creating the client, so a rejected booking leaves no orphan row)
    const dayBreaks = await loadBreaks(supabase, dow);
    const onBreak = (sid: string) =>
      dayBreaks.some((b: any) =>
        b.staff_id === sid && minutes < hmToMin(b.end_time) && hmToMin(b.start_time) < eMin);
    const staffHours = await loadStaffHours(supabase, dow);
    const worksNow = (sid: string) => {
      const wh = staffHours[sid];
      if (!wh) return true;                       // no per-stylist hours set
      if (wh.is_off) return false;
      return minutes >= hmToMin(wh.start_time) && eMin <= hmToMin(wh.end_time);
    };

    let assignedStaff: string | null = staff_id;
    if (assignedStaff) {
      if (!worksNow(assignedStaff)) {
        return json({ error: "הספר אינו עובד בשעה זו, בחרו שעה אחרת" }, 409);
      }
      if (onBreak(assignedStaff)) {
        return json({ error: "השעה נמצאת בהפסקת הספר, בחרו שעה אחרת" }, 409);
      }
    } else {
      // client chose "any" — pick the first stylist working & free at this time
      const sMs = start.getTime(), eMs = end.getTime(), pad = 12 * 3600000;
      const { data: staffRows } = await supabase
        .from("staff").select("id").eq("is_active", true).order("created_at");
      const { data: near } = await supabase
        .from("appointments").select("staff_id, starts_at, ends_at")
        .eq("branch_id", branch?.id)
        .gte("starts_at", new Date(sMs - pad).toISOString())
        .lte("starts_at", new Date(sMs + pad).toISOString())
        .not("status", "in", "(cancelled,no_show)");
      assignedStaff = ((staffRows ?? []).map((s: any) => s.id).find((sid: string) =>
        worksNow(sid) && !onBreak(sid) &&
        !(near ?? []).some((a: any) =>
          a.staff_id === sid && overlaps(sMs, eMs, +new Date(a.starts_at), +new Date(a.ends_at)))
      )) ?? null;
      if (!assignedStaff) return json({ error: "אין ספר פנוי בשעה זו, בחרו שעה אחרת" }, 409);
    }

    // find or create the client
    let { data: client } = await supabase
      .from("clients").select("id").eq("phone", phone).maybeSingle();
    if (!client) {
      const { data: created, error } = await supabase
        .from("clients")
        .insert({ full_name, phone, email, branch_id: branch?.id ?? null })
        .select("id").single();
      if (error) throw error;
      client = created;
    } else if (email) {
      await supabase.from("clients")
        .update({ email, full_name }).eq("id", client.id);
    }

    // ----- dynamic pricing: adjust base price by day/time/tier rules -----
    const { data: acct } = await supabase
      .from("loyalty_accounts")
      .select("loyalty_tiers(name)")
      .eq("client_id", client.id).maybeSingle();
    const tier = (acct?.loyalty_tiers as { name?: string } | null)?.name ?? "silver";

    const { data: rules } = await supabase
      .from("pricing_rules")
      .select("name, service_id, day_of_week, start_time, end_time, adjustment_type, adjustment_value, applies_to_tier, is_active")
      .eq("is_active", true)
      .or(`service_id.eq.${service_id},service_id.is.null`);

    const priced = applyPricing(service.base_price, rules ?? [], { dow, minutes, tier, serviceId: service_id });
    const finalPrice = priced.price;

    const { data: appt, error: apptErr } = await supabase
      .from("appointments")
      .insert({
        branch_id: branch?.id ?? null,
        client_id: client.id,
        staff_id: assignedStaff,
        status: "pending",
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        source: "website",
        total_price: finalPrice,
      })
      .select("id, starts_at, staff_id").single();
    if (apptErr) throw apptErr;

    await supabase.from("appointment_services").insert({
      appointment_id: appt.id,
      service_id: service.id,
      staff_id: assignedStaff,
      price: finalPrice,
      duration_minutes: service.duration_minutes,
    });

    let stylist: string | null = null;
    if (appt.staff_id) {
      const { data: s } = await supabase
        .from("staff").select("full_name").eq("id", appt.staff_id).maybeSingle();
      stylist = s?.full_name ?? null;
    }

    return json({
      status: "ok",
      appointment_id: appt.id,
      service: service.name,
      stylist,
      starts_at: appt.starts_at,
      price: finalPrice,
      base_price: service.base_price,
    });
  } catch (err) {
    console.error("book-appointment error:", err);
    return json({ error: "אירעה שגיאה, נסו שוב" }, 500);
  }
});

// ---------------------------------------------------------------------
// availability helpers
// ---------------------------------------------------------------------
async function getSlots(supabase: any, url: URL): Promise<Response> {
  const date = url.searchParams.get("date"); // YYYY-MM-DD (local)
  const service_id = url.searchParams.get("service_id");
  const staff_id = url.searchParams.get("staff_id") || null;
  if (!date || !service_id) return json({ slots: [] });

  const { data: service } = await supabase
    .from("services").select("duration_minutes")
    .eq("id", service_id).maybeSingle();
  if (!service) return json({ slots: [] });
  const dur = service.duration_minutes;

  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();

  const { data: branch } = await supabase
    .from("branches").select("id").order("created_at").limit(1).maybeSingle();

  const hours = await dayHoursMin(supabase, branch?.id, dow);
  if (!hours) return json({ slots: [] }); // closed that day

  // active stylists + their breaks for this weekday
  const { data: staffRows } = await supabase
    .from("staff").select("id").eq("is_active", true);
  const staffList: string[] = (staffRows ?? []).map((s: any) => s.id);
  const dayBreaks = await loadBreaks(supabase, dow);
  const breaksFor = (sid: string): [number, number][] =>
    dayBreaks.filter((b: any) => b.staff_id === sid)
      .map((b: any) => [hmToMin(b.start_time), hmToMin(b.end_time)] as [number, number]);

  // per-stylist working window (defaults to the salon hours when not set)
  const [openMin, closeMin] = hours;
  const staffHours = await loadStaffHours(supabase, dow);
  const windowFor = (sid: string): [number, number] | null => {
    const wh = staffHours[sid];
    if (!wh) return [openMin, closeMin];
    return wh.is_off ? null : [hmToMin(wh.start_time), hmToMin(wh.end_time)];
  };

  // existing appointments that day
  const dayStart = localToUTC(y, m, d, 0, 0).toISOString();
  const dayEnd = localToUTC(y, m, d, 23, 59).toISOString();
  const { data: appts } = await supabase
    .from("appointments")
    .select("starts_at, ends_at, staff_id")
    .eq("branch_id", branch?.id)
    .gte("starts_at", dayStart).lte("starts_at", dayEnd)
    .not("status", "in", "(cancelled,no_show)");
  const busy = (appts ?? []).map((a: any) => ({
    s: new Date(a.starts_at).getTime(),
    e: new Date(a.ends_at).getTime(),
    staff: a.staff_id,
  }));

  // a stylist is free for a slot when they have no overlapping appointment
  // (compared in ms) and no overlapping break (compared in minutes-of-day)
  const staffFree = (sid: string, sMs: number, eMs: number, sMin: number, eMin: number) => {
    const win = windowFor(sid);
    if (!win || sMin < win[0] || eMin > win[1]) return false;   // outside this stylist's hours
    if (busy.some((b) => b.staff === sid && overlaps(sMs, eMs, b.s, b.e))) return false;
    if (breaksFor(sid).some(([bs, be]) => sMin < be && bs < eMin)) return false;
    return true;
  };

  const now = Date.now();
  const slots: string[] = [];

  for (let mins = openMin; mins + dur <= closeMin; mins += SLOT_STEP_MIN) {
    const start = localToUTC(y, m, d, Math.floor(mins / 60), mins % 60);
    const sMs = start.getTime();
    const eMs = sMs + dur * 60000;
    if (sMs < now) continue; // skip past slots today
    const sMin = mins, eMin = mins + dur;

    const available = staff_id
      ? staffFree(staff_id, sMs, eMs, sMin, eMin)
      : staffList.some((sid) => staffFree(sid, sMs, eMs, sMin, eMin));
    if (available) slots.push(start.toISOString());
  }

  return json({ slots });
}

async function slotIsFree(
  supabase: any, branchId: string | undefined,
  start: Date, end: Date, staff_id: string | null,
): Promise<boolean> {
  const sMs = start.getTime(), eMs = end.getTime();
  const pad = 12 * 3600000;
  const { data: appts } = await supabase
    .from("appointments")
    .select("starts_at, ends_at, staff_id")
    .eq("branch_id", branchId)
    .gte("starts_at", new Date(sMs - pad).toISOString())
    .lte("starts_at", new Date(sMs + pad).toISOString())
    .not("status", "in", "(cancelled,no_show)");
  const busy = (appts ?? []).map((a: any) => ({
    s: new Date(a.starts_at).getTime(),
    e: new Date(a.ends_at).getTime(),
    staff: a.staff_id,
  }));
  if (staff_id) {
    return !busy.some((b) => b.staff === staff_id && overlaps(sMs, eMs, b.s, b.e));
  }
  const { count: staffCount } = await supabase
    .from("staff").select("id", { count: "exact", head: true })
    .eq("is_active", true);
  const capacity = Math.max(staffCount ?? 1, 1);
  const concurrent = busy.filter((b) => overlaps(sMs, eMs, b.s, b.e)).length;
  return concurrent < capacity;
}
