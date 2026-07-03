// =====================================================================
// SalonOS manager dashboard.
// Uses Supabase Auth (public anon key) + RLS: the only RLS policy grants
// `authenticated` full access, so a logged-in manager can read/update
// every table directly from the browser. The anon key is public by design.
// supabase-js is loaded as a classic <script> (window.supabase) so the page
// works whether served over http or opened directly as a file.
// =====================================================================
const SUPABASE_URL = "https://hdzmqoslaghgvydykixf.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhkem1xb3NsYWdoZ3Z5ZHlraXhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMzQ1NjgsImV4cCI6MjA5NzYxMDU2OH0.iPhY80HryCmboCpE9o8gVuwA4JZgt7IFPwws68IIdec";

const TZ = "Asia/Jerusalem";

// Guard: if the supabase library failed to load (e.g. CDN blocked), say so
// visibly instead of the page silently doing nothing.
if (!window.supabase || !window.supabase.createClient) {
  const lt = document.getElementById("loginToast");
  if (lt) {
    lt.textContent = "שגיאה: ספריית Supabase לא נטענה (בדוק חיבור אינטרנט / חוסם פרסומות)";
    lt.className = "toast show err";
  }
  throw new Error("supabase-js failed to load");
}
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---- tiny DOM helpers ----
const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const STATUS_HE = {
  pending: "ממתין", confirmed: "מאושר", arrived: "הגיע",
  completed: "הושלם", cancelled: "בוטל", no_show: "לא הגיע",
};

const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const fmtDay = (iso) =>
  new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "numeric", timeZone: TZ });
const fmtFull = (iso) =>
  new Date(iso).toLocaleString("he-IL", {
    weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: TZ,
  });

let toastTimer;
function toast(msg, kind = "ok") {
  const t = $("toast");
  t.textContent = msg;
  t.className = "toast toast--float show " + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = "toast toast--float"), 3000);
}

// =====================================================================
// Auth
// =====================================================================
const loginForm = $("loginForm");
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("loginBtn");
  const lt = $("loginToast");
  lt.className = "toast";
  btn.disabled = true; btn.classList.add("loading");
  const { error } = await sb.auth.signInWithPassword({
    email: $("email").value.trim(),
    password: $("password").value,
  });
  btn.disabled = false; btn.classList.remove("loading");
  if (error) {
    const reason = error.message === "Invalid login credentials"
      ? "מייל או סיסמה שגויים"
      : error.message;
    lt.textContent = "התחברות נכשלה — " + reason;
    lt.className = "toast show err";
    console.error("login error:", error);
  }
});

$("logoutBtn").addEventListener("click", async () => {
  await sb.auth.signOut();
});

sb.auth.onAuthStateChange((_event, session) => {
  if (session) {
    $("login").hidden = true;
    $("app").hidden = false;
    if (!booted) { booted = true; boot(); }
  } else {
    $("app").hidden = true;
    $("login").hidden = false;
  }
});

let booted = false;
function boot() {
  switchView("home");
}

// =====================================================================
// View switching
// =====================================================================
const views = ["home", "appointments", "calendar", "clients", "whatsapp", "reviews", "analytics", "inventory", "services", "staff", "plans", "finance", "marketing", "ai"];
document.querySelectorAll(".nav__item[data-view]").forEach((b) =>
  b.addEventListener("click", () => switchView(b.dataset.view)));

const DD_VIEWS = ["inventory", "services", "staff", "plans", "finance", "marketing", "ai"];
function switchView(name) {
  views.forEach((v) => ($("view-" + v).hidden = v !== name));
  document.querySelectorAll(".nav__item[data-view]").forEach((b) =>
    b.classList.toggle("is-active", b.dataset.view === name));
  if (name === "home") loadHome();
  if (name === "calendar") loadCalendar();
  if (name === "clients" && !clientsLoaded) loadClients();
  if (name === "whatsapp") loadWhatsApp();
  if (name === "reviews") loadReviews();
  if (name === "analytics") loadAnalytics();
  if (DD_VIEWS.includes(name)) renderView(name);
}

// =====================================================================
// Global search (clients / services / staff)
// =====================================================================
const gSearch = $("gSearch"), gRes = $("gSearchResults");
let gTimer;
gSearch.addEventListener("input", () => {
  clearTimeout(gTimer);
  const term = gSearch.value.trim();
  if (term.length < 2) { gRes.hidden = true; return; }
  gTimer = setTimeout(() => runGlobalSearch(term), 220);
});
gSearch.addEventListener("focus", () => {
  if (gSearch.value.trim().length >= 2 && gRes.innerHTML) gRes.hidden = false;
});
document.addEventListener("click", (e) => { if (!e.target.closest(".gsearch")) gRes.hidden = true; });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") gRes.hidden = true; });

async function runGlobalSearch(term) {
  const like = `%${term}%`;
  const [cl, ap, sv, st] = await Promise.all([
    sb.from("clients").select("id, full_name, phone")
      .or(`full_name.ilike.${like},phone.ilike.${like}`).order("full_name").limit(6),
    sb.from("appointments")
      .select("id, starts_at, status, clients!inner(full_name), appointment_services(services(name))")
      .ilike("clients.full_name", like)
      .order("starts_at", { ascending: false }).limit(5),
    sb.from("services").select("id, name, base_price").ilike("name", like).limit(4),
    sb.from("staff").select("id, full_name").ilike("full_name", like).eq("is_active", true).limit(4),
  ]);
  const clients = cl.data || [], appts = ap.data || [], services = sv.data || [], staff = st.data || [];
  const parts = [];
  if (clients.length) parts.push(`<div class="gs-group">לקוחות</div>` + clients.map((c) =>
    `<div class="gs-item" data-gs="client:${c.id}"><div class="gi-name">${esc(c.full_name)}</div><div class="gi-sub">${esc(c.phone || "")}</div></div>`).join(""));
  if (appts.length) parts.push(`<div class="gs-group">תורים</div>` + appts.map((a) => {
    const d = new Date(a.starts_at);
    const dstr = d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric", timeZone: TZ });
    const svc = (a.appointment_services || []).map((r) => r.services?.name).filter(Boolean)[0] || "";
    return `<div class="gs-item" data-gs="appt:${dayKey(d)}"><div class="gi-name">${esc(a.clients?.full_name || "לקוח/ה")}</div><div class="gi-sub">${dstr} · ${fmtTime(a.starts_at)}${svc ? " · " + esc(svc) : ""} · ${STATUS_HE[a.status]}</div></div>`;
  }).join(""));
  if (services.length) parts.push(`<div class="gs-group">שירותים</div>` + services.map((s) =>
    `<div class="gs-item" data-gs="service:${s.id}"><div class="gi-name">${esc(s.name)}</div><div class="gi-sub">₪${s.base_price}</div></div>`).join(""));
  if (staff.length) parts.push(`<div class="gs-group">צוות</div>` + staff.map((s) =>
    `<div class="gs-item" data-gs="staff:${s.id}"><div class="gi-name">${esc(s.full_name)}</div><div class="gi-sub">ספר/ית</div></div>`).join(""));
  gRes.innerHTML = parts.join("") || `<div class="gs-empty">לא נמצאו תוצאות</div>`;
  gRes.hidden = false;
}

gRes.addEventListener("click", (e) => {
  const item = e.target.closest("[data-gs]");
  if (!item) return;
  const [type, id] = item.dataset.gs.split(":");
  gRes.hidden = true; gSearch.value = "";
  if (type === "client") { switchView("clients"); openClient(id); }
  else if (type === "appt") { calDay = new Date(`${id}T00:00:00`); switchView("calendar"); }
  else if (type === "service") switchView("services");
  else if (type === "staff") switchView("staff");
});

// =====================================================================
// Appointments
// =====================================================================
const SELECT_APPT =
  "id, starts_at, ends_at, status, total_price, notes, staff_id, " +
  "clients(id, full_name, phone), staff(full_name), " +
  "appointment_services(service_id, services(name))";

$("apptRefresh").addEventListener("click", loadAppointments);
$("apptDate").addEventListener("change", loadAppointments);
$("apptStatus").addEventListener("change", loadAppointments);

async function loadAppointments() {
  const box = $("apptList");
  box.innerHTML = '<div class="loading-row">טוען…</div>';

  const status = $("apptStatus").value;
  const date = $("apptDate").value;
  let q = sb.from("appointments").select(SELECT_APPT).order("starts_at", { ascending: true });

  if (date) {
    q = q.gte("starts_at", `${date}T00:00:00`).lte("starts_at", `${date}T23:59:59`);
  } else if (status === "upcoming") {
    q = q.gte("starts_at", new Date().toISOString());
  }
  if (!["upcoming", "all"].includes(status)) q = q.eq("status", status);

  const { data, error } = await q.limit(300);
  if (error) { box.innerHTML = `<div class="empty">שגיאה בטעינה: ${esc(error.message)}</div>`; return; }
  if (!data.length) { box.innerHTML = '<div class="empty">אין תורים להצגה</div>'; return; }

  box.innerHTML = "";
  for (const a of data) box.appendChild(renderAppt(a));
}

function renderAppt(a) {
  const svc = (a.appointment_services || [])
    .map((r) => r.services?.name).filter(Boolean).join(", ") || "—";
  const node = el("div", "appt");
  node.innerHTML = `
    <div class="appt__time">
      <div class="t">${fmtTime(a.starts_at)}</div>
      <div class="d">${fmtDay(a.starts_at)}</div>
    </div>
    <div class="appt__main">
      <div class="name">${esc(a.clients?.full_name || "לקוח/ה")}</div>
      <div class="meta">
        <b>${esc(svc)}</b>
        ${a.staff?.full_name ? " · " + esc(a.staff.full_name) : ""}
        ${a.clients?.phone ? " · " + esc(a.clients.phone) : ""}
        ${a.total_price ? " · ₪" + a.total_price : ""}
      </div>
    </div>
    <div class="appt__side">
      <span class="badge badge--${a.status}">${STATUS_HE[a.status] || a.status}</span>
      <div class="appt__actions"></div>
    </div>`;

  const actions = node.querySelector(".appt__actions");
  const add = (label, status, cls) => {
    const b = el("button", "chip-btn " + (cls || ""), label);
    b.addEventListener("click", () => setStatus(a, status));
    actions.appendChild(b);
  };
  if (a.status === "pending") add("אישור", "confirmed", "chip-btn--ok");
  if (a.status === "confirmed") add("הגיע/ה", "arrived", "chip-btn--ok");
  if (["confirmed", "arrived"].includes(a.status)) add("הושלם", "completed", "chip-btn--ok");
  if (["pending", "confirmed"].includes(a.status)) add("לא הגיע/ה", "no_show");
  if (!["cancelled", "completed", "no_show"].includes(a.status)) add("ביטול", "cancelled", "chip-btn--danger");

  return node;
}

const STAMP = {
  confirmed: "confirmed_at", arrived: "arrived_at", cancelled: "cancelled_at",
};
async function setStatus(a, status) {
  const patch = { status };
  if (STAMP[status]) patch[STAMP[status]] = new Date().toISOString();
  const { error } = await sb.from("appointments").update(patch).eq("id", a.id);
  if (error) { toast("העדכון נכשל: " + error.message, "err"); return; }
  toast(`עודכן ל"${STATUS_HE[status]}"`);

  // notify the client on WhatsApp when confirming / cancelling (best-effort)
  if ((status === "confirmed" || status === "cancelled") && a.clients?.id) {
    const svc = (a.appointment_services || []).map((r) => r.services?.name).filter(Boolean).join(", ");
    const when = fmtFull(a.starts_at);
    const text = status === "confirmed"
      ? `שלום ${a.clients.full_name || ""}, התור שלך${svc ? " ל" + svc : ""} ל${when} אושר! נתראה 💇`
      : `שלום ${a.clients.full_name || ""}, התור שלך ל${when} בוטל. נשמח לעזור לקבוע מועד חדש 🙂`;
    notifyClient(a.clients.id, text, status === "confirmed" ? "confirmation" : "cancellation");
  }

  // when an appointment is completed: ask for a review + suggest an upsell
  if (status === "completed" && a.clients?.id) {
    requestReview(a);
    autoUpsell(a);
  }

  loadAppointments();
}

// auto-create an upsell opportunity for a completed appointment, picking a
// retail product that fits the treatment (best-effort, de-duplicated)
async function autoUpsell(a) {
  try {
    const line = (a.appointment_services || [])[0];
    const serviceId = line?.service_id || null;
    const serviceName = line?.services?.name || "";

    let cats = null;
    if (/צבע|גוון|בלייאז|highlight/i.test(serviceName)) cats = ["shampoo", "mask", "conditioner"];
    else if (/החלקה|קרטין|smooth/i.test(serviceName)) cats = ["mask", "conditioner"];

    const pick = async (withCats) => {
      let q = sb.from("products").select("id, name, retail_price")
        .eq("is_retail", true).eq("is_active", true);
      if (withCats) q = q.in("category", withCats);
      const { data } = await q.order("retail_price", { ascending: false }).limit(1);
      return data?.[0] || null;
    };
    const product = (cats && await pick(cats)) || await pick(null);
    if (!product) return;

    // skip if this client already has an open opportunity for this product
    const { data: dup } = await sb.from("sales_opportunities").select("id")
      .eq("client_id", a.clients.id).eq("product_id", product.id)
      .in("status", ["suggested", "sent"]).maybeSingle();
    if (dup) return;

    await sb.from("sales_opportunities").insert({
      client_id: a.clients.id,
      product_id: product.id,
      trigger_service_id: serviceId,
      message: `מומלץ ל${a.clients.full_name || "לקוח/ה"}: ${product.name}${serviceName ? ` לשמירה על התוצאה של ${serviceName}` : ""}`,
      status: "suggested",
    });
    toast(`💡 נוצרה הזדמנות מכירה: ${product.name}`);
  } catch (e) { /* best-effort */ }
}

// create a review request row + send the client a WhatsApp link (best-effort)
async function requestReview(a) {
  try {
    // avoid duplicates per appointment
    const { data: existing } = await sb.from("reviews").select("id").eq("appointment_id", a.id).maybeSingle();
    if (existing) return;
    const { data: rev, error } = await sb.from("reviews")
      .insert({ client_id: a.clients.id, appointment_id: a.id, staff_id: a.staff_id || null, requested_at: new Date().toISOString() })
      .select("id").single();
    if (error || !rev) return;
    const link = `${location.origin}/review/?r=${rev.id}`;
    const text = `שלום ${a.clients.full_name || ""}, תודה שביקרת אצלנו! נשמח אם תדרג/י את הביקור (דקה אחת): ${link}`;
    notifyClient(a.clients.id, text, "review_request");
  } catch (e) { /* best-effort */ }
}

// send an outbound WhatsApp message via the JWT-protected edge function
async function notifyClient(clientId, text, intent) {
  try {
    const { data, error } = await sb.functions.invoke("send-message", {
      body: { client_id: clientId, text, intent },
    });
    if (error) { toast("שליחת הודעה ללקוח נכשלה", "err"); return; }
    toast(data?.simulated ? "הודעה נשמרה (סימולציה — וואטסאפ לא מחובר)" : "הודעה נשלחה ללקוח");
  } catch (e) {
    toast("שליחת הודעה ללקוח נכשלה", "err");
  }
}

// =====================================================================
// Calendar (week view)
// =====================================================================
const CAL_START = 8;   // first hour shown
const CAL_END = 21;    // last hour shown (exclusive)
const HOUR_PX = 56;
let calDay = startOfDay(new Date());

function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function dayKey(d) { return new Date(d).toLocaleDateString("en-CA", { timeZone: TZ }); }
const hhmmToMin = (t) => { const [h, m] = String(t).split(":").map(Number); return h * 60 + (m || 0); };

$("calPrev").addEventListener("click", () => { calDay.setDate(calDay.getDate() - 1); loadCalendar(); });
$("calNext").addEventListener("click", () => { calDay.setDate(calDay.getDate() + 1); loadCalendar(); });
$("calToday").addEventListener("click", () => { calDay = startOfDay(new Date()); loadCalendar(); });

function minutesFromStart(iso) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(iso));
  const h = +parts.find((p) => p.type === "hour").value;
  const m = +parts.find((p) => p.type === "minute").value;
  return (h - CAL_START) * 60 + m;
}

// lay overlapping appointments side by side within one stylist column
function laneLayout(evs) {
  const items = evs.map((a) => ({ a, s: +new Date(a.starts_at), e: +new Date(a.ends_at) }))
    .sort((x, y) => x.s - y.s || x.e - y.e);
  const out = new Map();
  let cluster = [], clusterEnd = -1;
  const flush = () => {
    const lanes = [];
    cluster.forEach((it) => {
      let lane = lanes.findIndex((end) => end <= it.s);
      if (lane === -1) { lane = lanes.length; lanes.push(it.e); } else { lanes[lane] = it.e; }
      out.set(it.a, { lane });
    });
    cluster.forEach((it) => (out.get(it.a).total = lanes.length));
    cluster = []; clusterEnd = -1;
  };
  items.forEach((it) => {
    if (cluster.length && it.s >= clusterEnd) flush();
    cluster.push(it); clusterEnd = Math.max(clusterEnd, it.e);
  });
  flush();
  return out;
}

async function loadCalendar() {
  const wrap = $("calendar");
  wrap.innerHTML = '<div class="loading-row">טוען…</div>';

  const dow = calDay.getDay();
  const from = new Date(calDay); from.setHours(0, 0, 0, 0);
  const to = new Date(calDay); to.setHours(23, 59, 59, 999);
  $("calRange").textContent = calDay.toLocaleDateString("he-IL",
    { weekday: "long", day: "numeric", month: "long", timeZone: TZ });

  const [staffRes, apptRes, bhRes, brRes, shRes] = await Promise.all([
    sb.from("staff").select("id, full_name").eq("is_active", true).order("full_name"),
    sb.from("appointments").select(SELECT_APPT)
      .gte("starts_at", from.toISOString()).lte("starts_at", to.toISOString())
      .not("status", "in", "(cancelled,no_show)").order("starts_at", { ascending: true }),
    sb.from("business_hours").select("open_time, close_time, is_closed").eq("day_of_week", dow).maybeSingle(),
    sb.from("staff_breaks").select("staff_id, day_of_week, start_time, end_time, note"),
    sb.from("staff_hours").select("staff_id, start_time, end_time, is_off").eq("day_of_week", dow),
  ]);
  if (apptRes.error) { wrap.innerHTML = `<div class="empty">שגיאה: ${esc(apptRes.error.message)}</div>`; return; }

  const staff = staffRes.data || [];
  const appts = apptRes.data || [];
  const bh = bhRes.data;
  const breaks = (brRes.data || []).filter((b) => b.day_of_week == null || b.day_of_week === dow);
  const shMap = {};
  (shRes.data || []).forEach((r) => (shMap[r.staff_id] = r));

  // columns = active stylists, plus an "unassigned" column if any such appt
  const cols = staff.map((s) => ({ id: s.id, name: s.full_name }));
  if (appts.some((a) => !a.staff_id)) cols.push({ id: null, name: "ללא ספר" });
  if (!cols.length) { wrap.innerHTML = '<div class="empty">לא הוגדרו אנשי צוות פעילים</div>'; return; }

  const hoursCount = CAL_END - CAL_START;
  const grid = el("div", "cal-grid");
  grid.style.gridTemplateColumns = `54px repeat(${cols.length}, minmax(150px, 1fr))`;

  grid.appendChild(el("div", "cal-corner"));
  cols.forEach((c) => {
    const h = el("div", "cal-head");
    h.innerHTML = `<div class="dow">${esc(c.name)}</div>`;
    grid.appendChild(h);
  });

  const gutter = el("div", "");
  for (let hh = CAL_START; hh < CAL_END; hh++) {
    const c = el("div", "cal-hour", `${String(hh).padStart(2, "0")}:00`);
    c.style.height = HOUR_PX + "px";
    gutter.appendChild(c);
  }
  grid.appendChild(gutter);

  const closedAllDay = bh ? bh.is_closed : false;
  const openMin = bh && !bh.is_closed ? hhmmToMin(bh.open_time) : null;
  const closeMin = bh && !bh.is_closed ? hhmmToMin(bh.close_time) : null;
  const toPx = (min) => (min / 60) * HOUR_PX;

  cols.forEach((c) => {
    const col = el("div", "cal-col");
    col.style.height = hoursCount * HOUR_PX + "px";
    // click an empty area to create a new appointment for this stylist at that time
    col.style.cursor = "copy";
    col.addEventListener("click", (ev) => {
      if (ev.target.closest(".cal-event")) return; // don't hijack existing appointments
      const y = ev.clientY - col.getBoundingClientRect().top;
      let mins = CAL_START * 60 + Math.round(((y / HOUR_PX) * 60) / 30) * 30;
      mins = Math.min(Math.max(mins, CAL_START * 60), CAL_END * 60 - 30);
      const t = `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
      openApptModal({ date: dayKey(calDay), time: t, staffId: c.id });
    });
    for (let hh = CAL_START; hh < CAL_END; hh++) {
      const line = el("div", "hour-line"); line.style.height = HOUR_PX + "px"; col.appendChild(line);
    }

    // shade outside this stylist's working window (falls back to salon hours)
    const addClosed = (fromMin, toMin) => {
      if (toMin <= fromMin) return;
      const b = el("div", "cal-closed");
      b.style.top = toPx(fromMin - CAL_START * 60) + "px";
      b.style.height = toPx(toMin - fromMin) + "px";
      col.appendChild(b);
    };
    let winOpen = openMin, winClose = closeMin, off = closedAllDay;
    if (c.id) {
      const wh = shMap[c.id];
      if (wh) {
        if (wh.is_off) off = true;
        else { winOpen = hhmmToMin(wh.start_time); winClose = hhmmToMin(wh.end_time); }
      }
    }
    if (off || winOpen == null) addClosed(CAL_START * 60, CAL_END * 60);
    else {
      addClosed(CAL_START * 60, Math.max(CAL_START * 60, winOpen));
      addClosed(Math.min(CAL_END * 60, winClose), CAL_END * 60);
    }

    // breaks for this stylist
    breaks.filter((b) => b.staff_id === c.id).forEach((b) => {
      const s = hhmmToMin(b.start_time), e = hhmmToMin(b.end_time);
      const bl = el("div", "cal-break");
      bl.style.top = toPx(s - CAL_START * 60) + "px";
      bl.style.height = toPx(e - s) + "px";
      bl.innerHTML = `<span>${esc(b.note || "הפסקה")} · ${String(b.start_time).slice(0, 5)}–${String(b.end_time).slice(0, 5)}</span>`;
      col.appendChild(bl);
    });

    // appointments for this stylist, with side-by-side lanes on overlap
    const mine = appts.filter((a) => (a.staff_id || null) === c.id);
    const layout = laneLayout(mine);
    mine.forEach((a) => col.appendChild(renderEvent(a, layout.get(a) || { lane: 0, total: 1 })));

    grid.appendChild(col);
  });

  wrap.innerHTML = "";
  wrap.appendChild(grid);
}

function renderEvent(a, pos) {
  const top = Math.max(0, (minutesFromStart(a.starts_at) / 60) * HOUR_PX);
  const durMin = Math.max(20, (new Date(a.ends_at) - new Date(a.starts_at)) / 60000);
  const total = (pos && pos.total) || 1, lane = (pos && pos.lane) || 0;
  const svc = (a.appointment_services || []).map((r) => r.services?.name).filter(Boolean)[0] || "";
  const ev = el("div", `cal-event s-${a.status}`);
  ev.style.top = top + "px";
  ev.style.height = (durMin / 60) * HOUR_PX - 3 + "px";
  ev.style.left = `calc(${(lane / total) * 100}% + 2px)`;
  ev.style.width = `calc(${100 / total}% - 4px)`;
  ev.style.right = "auto";
  ev.innerHTML = `<div class="ce-name">${esc(a.clients?.full_name || "לקוח/ה")}</div>
    <div class="ce-time">${fmtTime(a.starts_at)}</div>
    ${svc ? `<div class="ce-svc">${esc(svc)}</div>` : ""}`;
  ev.title = `${a.clients?.full_name || ""} · ${fmtTime(a.starts_at)} · ${svc} · ${STATUS_HE[a.status]}`;
  return ev;
}

// =====================================================================
// New appointment (from the calendar)
// =====================================================================
const apptModal = $("apptModal");
let apptCache = null;       // { services, staff, clients, branchId }
let apptConflictOK = false; // true once the user overrode a conflict warning

apptModal.querySelectorAll("[data-aclose]").forEach((n) =>
  n.addEventListener("click", () => (apptModal.hidden = true)));
$("calNew").addEventListener("click", () => openApptModal({}));
$("apptClient").addEventListener("change", () => {
  $("apptNewRow").style.display = $("apptClient").value ? "none" : "";
});
// changing the slot / stylist / service cancels an earlier conflict override
["apptStaff", "apptService", "apptDate", "apptTime"].forEach((id) =>
  $(id).addEventListener("change", resetApptConflict));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") apptModal.hidden = true; });

function resetApptConflict() {
  apptConflictOK = false;
  const lbl = apptModal.querySelector(".btn__label");
  if (lbl) lbl.textContent = "שמירת תור";
}

async function loadApptCache() {
  if (apptCache) return apptCache;
  const [svc, stf, cl, br] = await Promise.all([
    sb.from("services").select("id, name, duration_minutes, base_price").eq("is_active", true).order("name"),
    sb.from("staff").select("id, full_name").eq("is_active", true).order("full_name"),
    sb.from("clients").select("id, full_name, phone").order("full_name").limit(500),
    sb.from("branches").select("id").order("created_at").limit(1).maybeSingle(),
  ]);
  apptCache = {
    services: svc.data || [], staff: stf.data || [],
    clients: cl.data || [], branchId: br.data?.id || null,
  };
  $("apptService").innerHTML = apptCache.services.map((s) =>
    `<option value="${s.id}" data-dur="${s.duration_minutes}" data-price="${s.base_price}">${esc(s.name)} · ${s.duration_minutes} דק׳ · ₪${s.base_price}</option>`).join("");
  $("apptStaff").innerHTML = `<option value="">— ללא שיוך —</option>` +
    apptCache.staff.map((s) => `<option value="${s.id}">${esc(s.full_name)}</option>`).join("");
  $("apptClient").innerHTML = `<option value="">— לקוח חדש —</option>` +
    apptCache.clients.map((c) => `<option value="${c.id}">${esc(c.full_name)}${c.phone ? " · " + esc(c.phone) : ""}</option>`).join("");
  return apptCache;
}

async function openApptModal({ date, time, staffId } = {}) {
  await loadApptCache();
  $("apptToast").className = "toast";
  $("apptClient").value = "";
  $("apptName").value = ""; $("apptPhone").value = "";
  $("apptNewRow").style.display = "";
  $("apptDate").value = date || dayKey(new Date());
  $("apptTime").value = time || "10:00";
  $("apptStaff").value = staffId || "";
  resetApptConflict();
  apptModal.hidden = false;
}

$("apptForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const toast = $("apptToast");
  const svcOpt = $("apptService").selectedOptions[0];
  const serviceId = $("apptService").value;
  const date = $("apptDate").value, time = $("apptTime").value;
  if (!serviceId || !date || !time) { toast.textContent = "נא למלא שירות, תאריך ושעה"; toast.className = "toast show err"; return; }
  const dur = +svcOpt.dataset.dur || 30;
  const price = +svcOpt.dataset.price || 0;
  const staffId = $("apptStaff").value || null;
  const starts = new Date(`${date}T${time}`);
  const ends = new Date(starts.getTime() + dur * 60000);
  const sMs = starts.getTime(), eMs = ends.getTime();

  // ----- soft conflict warning: click again to save anyway -----
  if (staffId && !apptConflictOK) {
    const pad = 12 * 3600000;
    const { data: clash } = await sb.from("appointments")
      .select("starts_at, ends_at, clients(full_name)")
      .eq("staff_id", staffId)
      .gte("starts_at", new Date(sMs - pad).toISOString())
      .lte("starts_at", new Date(sMs + pad).toISOString())
      .not("status", "in", "(cancelled,no_show)");
    const hit = (clash || []).find((a) =>
      sMs < new Date(a.ends_at).getTime() && new Date(a.starts_at).getTime() < eMs);
    if (hit) {
      const ht = new Date(hit.starts_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
      toast.textContent = `⚠️ התנגשות: לספר כבר יש תור ב-${ht}${hit.clients?.full_name ? " · " + hit.clients.full_name : ""}. לחצו שוב לשמירה בכל זאת.`;
      toast.className = "toast show err";
      apptConflictOK = true;
      const lbl = e.currentTarget.querySelector(".btn__label");
      if (lbl) lbl.textContent = "שמור בכל זאת";
      return;
    }
  }

  const btn = e.currentTarget.querySelector("button[type=submit]");
  btn.disabled = true; btn.classList.add("loading");
  try {
    let cid = $("apptClient").value || null;
    if (!cid) {
      const name = $("apptName").value.trim(), phone = $("apptPhone").value.trim();
      if (!name || !phone) throw new Error("נא להזין שם וטלפון ללקוח חדש");
      const { data: exist } = await sb.from("clients").select("id").eq("phone", phone).maybeSingle();
      if (exist) cid = exist.id;
      else {
        const { data: created, error } = await sb.from("clients")
          .insert({ full_name: name, phone, branch_id: apptCache.branchId }).select("id").single();
        if (error) throw error;
        cid = created.id;
      }
    }
    const { data: appt, error: aerr } = await sb.from("appointments").insert({
      branch_id: apptCache.branchId, client_id: cid, staff_id: staffId,
      status: "confirmed", starts_at: starts.toISOString(), ends_at: ends.toISOString(),
      source: "walk_in", total_price: price, confirmed_at: new Date().toISOString(),
    }).select("id").single();
    if (aerr) throw aerr;
    await sb.from("appointment_services").insert({
      appointment_id: appt.id, service_id: serviceId, staff_id: staffId, price, duration_minutes: dur,
    });
    apptModal.hidden = true;
    apptCache = null;            // refresh client list next open (a new client may exist)
    if (calDay && dayKey(calDay) === date) loadCalendar();
    else { calDay = new Date(`${date}T00:00:00`); loadCalendar(); }
  } catch (err) {
    toast.textContent = "שמירה נכשלה: " + err.message; toast.className = "toast show err";
  } finally {
    btn.disabled = false; btn.classList.remove("loading");
  }
});

// =====================================================================
// Clients
// =====================================================================
let clientsLoaded = false;
let searchTimer;
$("clientSearch").addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadClients($("clientSearch").value.trim()), 250);
});

async function loadClients(term = "") {
  clientsLoaded = true;
  const box = $("clientList");
  box.innerHTML = '<div class="loading-row">טוען…</div>';

  let q = sb.from("clients")
    .select("id, full_name, phone, email, loyalty_accounts(points_balance, loyalty_tiers(name))")
    .order("created_at", { ascending: false }).limit(200);
  if (term) q = q.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`);

  const { data, error } = await q;
  if (error) { box.innerHTML = `<div class="empty">שגיאה: ${esc(error.message)}</div>`; return; }
  if (!data.length) { box.innerHTML = '<div class="empty">לא נמצאו לקוחות</div>'; return; }

  box.innerHTML = "";
  for (const c of data) {
    const acct = c.loyalty_accounts;
    const tier = acct?.loyalty_tiers?.name;
    const row = el("div", "client-row");
    row.innerHTML = `
      <div class="avatar">${esc((c.full_name || "?").trim().charAt(0))}</div>
      <div>
        <div class="name">${esc(c.full_name)}</div>
        <div class="sub">${esc(c.phone || "ללא טלפון")}${c.email ? " · " + esc(c.email) : ""}</div>
      </div>
      <div class="tier">${acct ? `${acct.points_balance} נק׳${tier ? " · <b>" + esc(tier) + "</b>" : ""}` : ""}</div>`;
    row.addEventListener("click", () => openClient(c.id));
    box.appendChild(row);
  }
}

// ---- client card drawer ----
const drawer = $("drawer");
drawer.querySelectorAll("[data-close]").forEach((n) =>
  n.addEventListener("click", () => (drawer.hidden = true)));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") drawer.hidden = true; });

let currentClientId = null;
async function openClient(id) {
  currentClientId = id;
  drawer.hidden = false;
  const body = $("drawerBody");
  body.innerHTML = '<div class="loading-row">טוען…</div>';

  const [{ data: c, error: ce }, { data: appts }, { data: allergies }, { data: family }, { data: subs }, { data: hair }, { data: formulas }, { data: opps }] = await Promise.all([
    sb.from("clients")
      .select("*, loyalty_accounts(points_balance, lifetime_points, loyalty_tiers(name)), preferred_staff:staff!clients_preferred_staff_id_fkey(full_name)")
      .eq("id", id).single(),
    sb.from("appointments")
      .select("id, starts_at, status, total_price, appointment_services(services(name))")
      .eq("client_id", id).order("starts_at", { ascending: false }).limit(20),
    sb.from("client_allergies").select("substance, severity, notes").eq("client_id", id),
    sb.from("client_family_members").select("full_name, relationship").eq("client_id", id),
    sb.from("client_subscriptions").select("status, started_at, renews_at, subscription_plans(name)").eq("client_id", id),
    sb.from("hair_history").select("performed_on, color_formula, professional_notes, next_treatment_recommendation, services(name), staff(full_name)").eq("client_id", id).order("performed_on", { ascending: false }).limit(10),
    sb.from("client_formulas").select("id, title, developer_volume, developer_amount, developer_unit, mixing_ratio, processing_minutes, technique, application_areas, result_notes, performed_on, toner_brand, toner_shade, toner_developer, toner_minutes, patch_test_done, patch_test_date, patch_test_notes, staff(full_name), client_formula_components(id, brand, shade_code, shade_name, amount, unit, sort_order)").eq("client_id", id).order("performed_on", { ascending: false }),
    sb.from("sales_opportunities").select("id, message, status, products(name, retail_price)").eq("client_id", id).in("status", ["suggested", "sent"]).order("created_at", { ascending: false }),
  ]);

  if (ce) { body.innerHTML = `<div class="empty">שגיאה: ${esc(ce.message)}</div>`; return; }

  const acct = c.loyalty_accounts;
  const completed = (appts || []).filter((a) => a.status === "completed");
  const spent = completed.reduce((s, a) => s + (a.total_price || 0), 0);

  const info = [
    ["טלפון", c.phone],
    ["אימייל", c.email],
    ["יום הולדת", c.birthday ? new Date(c.birthday).toLocaleDateString("he-IL") : null],
    ["כתובת", c.address],
    ["ספר/ית מועדף/ת", c.preferred_staff?.full_name],
    ["דיוור", c.marketing_opt_in ? "מאושר" : "לא מאושר"],
    ["העדפות", c.preferences],
    ["הערות טיפול", c.service_notes],
  ].filter(([, v]) => v);

  const hist = (appts || []).map((a) => {
    const svc = (a.appointment_services || []).map((r) => r.services?.name).filter(Boolean).join(", ") || "—";
    return `<div class="dc-hist-item">
      <div class="top"><b>${esc(svc)}</b><span class="badge badge--${a.status}">${STATUS_HE[a.status] || a.status}</span></div>
      <div class="when">${fmtFull(a.starts_at)}${a.total_price ? " · ₪" + a.total_price : ""}</div>
    </div>`;
  }).join("") || '<div class="when" style="color:var(--muted)">אין היסטוריית תורים</div>';

  // optional extra sections (allergies / family / subscription / hair history)
  const allergySec = (allergies && allergies.length) ? `
    <div class="dc-section">
      <h4>אלרגיות ורגישויות</h4>
      ${allergies.map((a) => `<div class="dc-row"><span class="k">${esc(a.substance)}${a.severity ? " · " + esc(a.severity) : ""}</span><span>${esc(a.notes || "")}</span></div>`).join("")}
    </div>` : "";
  const familySec = (family && family.length) ? `
    <div class="dc-section">
      <h4>בני משפחה</h4>
      ${family.map((f) => `<div class="dc-row"><span class="k">${esc(f.relationship || "קרוב/ה")}</span><span>${esc(f.full_name || "")}</span></div>`).join("")}
    </div>` : "";
  const subSec = (subs && subs.length) ? `
    <div class="dc-section">
      <h4>מנויים</h4>
      ${subs.map((s) => `<div class="dc-row"><span class="k">${esc(s.subscription_plans?.name || "מנוי")}</span><span>${heMap("subscription_status", s.status)}</span></div>`).join("")}
    </div>` : "";
  const hairSec = (hair && hair.length) ? `
    <div class="dc-section">
      <h4>היסטוריית טיפולי שיער</h4>
      <div class="dc-hist">${hair.map((h) => `<div class="dc-hist-item">
        <div class="top"><b>${esc(h.services?.name || "טיפול")}</b><span class="when">${dateHe(h.performed_on)}</span></div>
        ${h.color_formula ? `<div class="when">פורמולה: ${esc(h.color_formula)}</div>` : ""}
        ${h.professional_notes ? `<div class="when">${esc(h.professional_notes)}</div>` : ""}
        ${h.next_treatment_recommendation ? `<div class="when">המלצה: ${esc(h.next_treatment_recommendation)}</div>` : ""}
        ${h.staff?.full_name ? `<div class="when">ע"י ${esc(h.staff.full_name)}</div>` : ""}
      </div>`).join("")}</div>
    </div>` : "";

  const formulaSec = `
    <div class="dc-section">
      <div class="dc-section__head">
        <h4>פורמולות צבע</h4>
        <button class="add-btn" id="addFormulaBtn">+ פורמולה חדשה</button>
      </div>
      ${(formulas && formulas.length) ? formulas.map((f) => formulaCard(f)).join("")
        : '<div class="when" style="color:var(--muted)">אין פורמולות שמורות</div>'}
    </div>`;

  const upsellSec = (opps && opps.length) ? `
    <div class="dc-section">
      <h4>הזדמנויות מכירה</h4>
      ${opps.map((o) => `<div class="ups-card">
        <div class="ups-top"><b>${esc(o.products?.name || "מוצר")}</b>${o.products?.retail_price ? `<span class="rec-val">₪${o.products.retail_price}</span>` : ""}</div>
        ${o.message ? `<div class="ups-msg">${esc(o.message)}</div>` : ""}
        <div class="ups-actions">
          <button class="chip-btn chip-btn--ok" data-opp-convert="${o.id}">נמכר ✓</button>
          <button class="chip-btn" data-opp-dismiss="${o.id}">דחה</button>
        </div>
      </div>`).join("")}
    </div>` : "";

  body.innerHTML = `
    <div class="dc-head">
      <div class="avatar">${esc((c.full_name || "?").trim().charAt(0))}</div>
      <div>
        <h3>${esc(c.full_name)}</h3>
        <div class="sub">${esc(c.phone || "")}</div>
      </div>
    </div>
    <div class="dc-stats">
      <div class="dc-stat"><div class="v">${completed.length}</div><div class="k">תורים שהושלמו</div></div>
      <div class="dc-stat"><div class="v">₪${spent}</div><div class="k">סה״כ הוצאה</div></div>
      <div class="dc-stat"><div class="v">${acct?.points_balance ?? 0}</div><div class="k">נק׳ נאמנות${acct?.loyalty_tiers?.name ? " · " + esc(acct.loyalty_tiers.name) : ""}</div></div>
    </div>
    <div class="dc-section">
      <h4>פרטים</h4>
      ${info.map(([k, v]) => `<div class="dc-row"><span class="k">${k}</span><span>${esc(v)}</span></div>`).join("")}
    </div>
    ${formulaSec}
    ${upsellSec}
    ${allergySec}
    ${subSec}
    ${familySec}
    <div class="dc-section">
      <h4>היסטוריית תורים</h4>
      <div class="dc-hist">${hist}</div>
    </div>
    ${hairSec}`;

  // wire formula buttons (data stashed for the edit modal)
  formulaCache = {};
  (formulas || []).forEach((f) => (formulaCache[f.id] = f));
  $("addFormulaBtn").addEventListener("click", () => openFormula(null));
  body.querySelectorAll("[data-formula]").forEach((btn) =>
    btn.addEventListener("click", () => openFormula(formulaCache[btn.dataset.formula])));
}

// ---- formula card + editor ----
let formulaCache = {};

function formulaCard(f) {
  const comps = (f.client_formula_components || [])
    .slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const colors = comps.length ? comps.map((c) => `
    <div class="fc-color">
      <span class="code">${esc(c.shade_code || "—")}</span>
      ${c.shade_name ? `<span>${esc(c.shade_name)}</span>` : ""}
      ${c.brand ? `<span class="brand">${esc(c.brand)}</span>` : ""}
      <span class="amt">${c.amount != null ? esc(c.amount) + esc(c.unit || "g") : ""}</span>
    </div>`).join("") : '<div class="fc-notes">לא הוזנו צבעים</div>';

  const tags = [];
  if (f.developer_volume != null) tags.push(`<span class="fc-tag">חמצן <b>${esc(f.developer_volume)} vol</b></span>`);
  if (f.developer_amount != null) tags.push(`<span class="fc-tag">כמות חמצן <b>${esc(f.developer_amount)} ${esc(f.developer_unit || "ml")}</b></span>`);
  if (f.mixing_ratio) tags.push(`<span class="fc-tag">יחס <b>${esc(f.mixing_ratio)}</b></span>`);
  if (f.processing_minutes != null) tags.push(`<span class="fc-tag">החדרה <b>${esc(f.processing_minutes)} דק׳</b></span>`);
  if (f.technique) tags.push(`<span class="fc-tag">${esc(f.technique)}</span>`);
  if (f.application_areas) tags.push(`<span class="fc-tag">${esc(f.application_areas)}</span>`);

  const tonerStr = [f.toner_shade, f.toner_brand, f.toner_developer,
    f.toner_minutes != null ? f.toner_minutes + " דק׳" : null].filter(Boolean).map(esc).join(" · ");
  const tonerLine = tonerStr ? `<div class="fc-tag fc-tag--toner">טונר: <b>${tonerStr}</b></div>` : "";
  const patchLine = f.patch_test_done
    ? `<div class="fc-tag fc-tag--ok">✓ בדיקת רגישות${f.patch_test_date ? " · " + dateHe(f.patch_test_date) : ""}${f.patch_test_notes ? " · " + esc(f.patch_test_notes) : ""}</div>`
    : `<div class="fc-tag fc-tag--warn">✗ ללא בדיקת רגישות</div>`;

  return `<div class="formula-card">
    <div class="fc-top">
      <span class="fc-title">${esc(f.title || "פורמולה")}</span>
      <span class="fc-date">${dateHe(f.performed_on)}${f.staff?.full_name ? " · " + esc(f.staff.full_name) : ""}
        <button class="row-edit" data-formula="${f.id}">עריכה</button></span>
    </div>
    <div class="fc-colors">${colors}</div>
    ${tags.length ? `<div class="fc-meta">${tags.join("")}</div>` : ""}
    <div class="fc-meta">${tonerLine}${patchLine}</div>
    ${f.result_notes ? `<div class="fc-notes">${esc(f.result_notes)}</div>` : ""}
  </div>`;
}

// ---- formula modal ----
const fmodal = $("fmodal");
let fEditId = null;
fmodal.querySelectorAll("[data-fclose]").forEach((n) => n.addEventListener("click", () => (fmodal.hidden = true)));
$("ffAddComp").addEventListener("click", () => addCompRow());

function addCompRow(c = {}) {
  const row = el("div", "comp-row");
  row.innerHTML = `
    <input class="cc-shade" placeholder="מס׳ צבע / גוון" value="${esc(c.shade_name ? `${c.shade_code || ""} ${c.shade_name}`.trim() : (c.shade_code || ""))}" />
    <input class="cc-brand" placeholder="חברה" value="${esc(c.brand || "")}" />
    <input class="cc-amount" type="number" step="0.01" placeholder="כמות" value="${c.amount ?? ""}" />
    <button type="button" class="comp-del" title="הסרה">✕</button>`;
  row.querySelector(".comp-del").addEventListener("click", () => row.remove());
  $("ffComponents").appendChild(row);
}

function openFormula(f) {
  fEditId = f?.id || null;
  $("fmodalTitle").textContent = f ? "עריכת פורמולה" : "פורמולה חדשה";
  $("fmodalToast").className = "toast";
  const set = (id, v) => ($(id).value = v ?? "");
  set("ff_title", f?.title);
  set("ff_performed_on", f?.performed_on ? String(f.performed_on).slice(0, 10) : new Date().toISOString().slice(0, 10));
  set("ff_developer_volume", f?.developer_volume);
  set("ff_developer_amount", f?.developer_amount);
  set("ff_developer_unit", f?.developer_unit ?? "ml");
  set("ff_mixing_ratio", f?.mixing_ratio);
  set("ff_processing_minutes", f?.processing_minutes);
  set("ff_technique", f?.technique);
  set("ff_application_areas", f?.application_areas);
  set("ff_result_notes", f?.result_notes);
  set("ff_toner_shade", f?.toner_shade);
  set("ff_toner_brand", f?.toner_brand);
  set("ff_toner_developer", f?.toner_developer);
  set("ff_toner_minutes", f?.toner_minutes);
  set("ff_patch_test_date", f?.patch_test_date ? String(f.patch_test_date).slice(0, 10) : "");
  set("ff_patch_test_notes", f?.patch_test_notes);
  $("ff_patch_test_done").checked = !!f?.patch_test_done;

  $("ffComponents").innerHTML = "";
  const comps = (f?.client_formula_components || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  if (comps.length) comps.forEach((c) => addCompRow(c));
  else { addCompRow(); addCompRow(); }

  fmodal.hidden = false;
}

$("fmodalForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentClientId) return;
  const v = (id) => { const x = $(id).value.trim(); return x === "" ? null : x; };
  const numv = (id) => { const x = $(id).value.trim(); return x === "" ? null : Number(x); };

  const header = {
    client_id: currentClientId,
    title: v("ff_title"),
    performed_on: v("ff_performed_on"),
    developer_volume: numv("ff_developer_volume"),
    developer_amount: numv("ff_developer_amount"),
    developer_unit: v("ff_developer_unit"),
    mixing_ratio: v("ff_mixing_ratio"),
    processing_minutes: numv("ff_processing_minutes"),
    technique: v("ff_technique"),
    application_areas: v("ff_application_areas"),
    result_notes: v("ff_result_notes"),
    toner_shade: v("ff_toner_shade"),
    toner_brand: v("ff_toner_brand"),
    toner_developer: v("ff_toner_developer"),
    toner_minutes: numv("ff_toner_minutes"),
    patch_test_done: $("ff_patch_test_done").checked,
    patch_test_date: v("ff_patch_test_date"),
    patch_test_notes: v("ff_patch_test_notes"),
  };

  // collect components: shade input may hold "code name" — split on first space
  const comps = [];
  $("ffComponents").querySelectorAll(".comp-row").forEach((row, idx) => {
    const shade = row.querySelector(".cc-shade").value.trim();
    const brand = row.querySelector(".cc-brand").value.trim();
    const amount = row.querySelector(".cc-amount").value.trim();
    if (!shade && !brand && !amount) return; // skip empty rows
    const sp = shade.indexOf(" ");
    comps.push({
      shade_code: sp === -1 ? (shade || null) : shade.slice(0, sp),
      shade_name: sp === -1 ? null : shade.slice(sp + 1),
      brand: brand || null,
      amount: amount === "" ? null : Number(amount),
      unit: "g",
      sort_order: idx,
    });
  });

  const btn = e.currentTarget.querySelector("button[type=submit]");
  btn.disabled = true; btn.classList.add("loading");
  const fail = (msg) => { const t = $("fmodalToast"); t.textContent = "שמירה נכשלה: " + msg; t.className = "toast show err"; btn.disabled = false; btn.classList.remove("loading"); };

  let formulaId = fEditId;
  if (formulaId) {
    const { error } = await sb.from("client_formulas").update(header).eq("id", formulaId);
    if (error) return fail(error.message);
    await sb.from("client_formula_components").delete().eq("formula_id", formulaId);
  } else {
    const { data, error } = await sb.from("client_formulas").insert(header).select("id").single();
    if (error) return fail(error.message);
    formulaId = data.id;
  }
  if (comps.length) {
    const { error } = await sb.from("client_formula_components")
      .insert(comps.map((c) => ({ ...c, formula_id: formulaId })));
    if (error) return fail(error.message);
  }

  btn.disabled = false; btn.classList.remove("loading");
  fmodal.hidden = true;
  toast(fEditId ? "הפורמולה עודכנה" : "הפורמולה נוספה");
  openClient(currentClientId); // refresh drawer
});

// =====================================================================
// Formatting helpers + Hebrew enum maps
// =====================================================================
const dash = (v) => v == null || v === "" ? '<span class="muted-cell">—</span>' : esc(v);
const money = (v) => v == null ? '<span class="muted-cell">—</span>' : `<span class="num">₪${v}</span>`;
const numCell = (v) => v == null ? '<span class="muted-cell">—</span>' : `<span class="num">${v}</span>`;
const dateHe = (v) => v ? new Date(v).toLocaleDateString("he-IL", { timeZone: TZ }) : '<span class="muted-cell">—</span>';
const dtHe = (v) => v ? new Date(v).toLocaleString("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ }) : '<span class="muted-cell">—</span>';
const boolPill = (v) => v ? '<span class="pill pill--ok">כן</span>' : '<span class="pill pill--off">לא</span>';
const activePill = (v) => v ? '<span class="pill pill--ok">פעיל</span>' : '<span class="pill pill--off">כבוי</span>';
const starsCell = (n) => n ? `<span class="stars">${"★".repeat(n)}${"☆".repeat(5 - n)}</span>` : '<span class="muted-cell">—</span>';
const trunc = (v) => v ? `<span class="truncate" title="${esc(v)}">${esc(v)}</span>` : '<span class="muted-cell">—</span>';
const benefitsList = (b) => {
  if (!b) return '<span class="muted-cell">—</span>';
  const arr = Array.isArray(b) ? b : (typeof b === "object" ? Object.values(b) : [b]);
  if (!arr.length) return '<span class="muted-cell">—</span>';
  return arr.map((x) => esc(typeof x === "object" ? JSON.stringify(x) : x)).join(" · ");
};
const riskPill = (lvl) => {
  const m = { low: "badge--completed", medium: "badge--pending", high: "badge--cancelled" };
  return `<span class="badge ${m[lvl] || "badge--no_show"}">${heMap("risk_level", lvl)}</span>`;
};

const MAPS = {
  role: { owner: "בעלים", manager: "מנהל/ת", stylist: "ספר/ית", receptionist: "קבלה", assistant: "סייע/ת" },
  pcat: { shampoo: "שמפו", mask: "מסכה", conditioner: "מרכך", color: "צבע", styling: "עיצוב", treatment: "טיפוח", tools: "כלים" },
  invoice_status: { draft: "טיוטה", issued: "הופקה", paid: "שולמה", partially_paid: "שולמה חלקית", cancelled: "בוטלה", refunded: "זוכתה" },
  payment_method: { cash: "מזומן", card: "אשראי", bit: "ביט", bank_transfer: "העברה בנקאית", subscription: "מנוי", other: "אחר" },
  po_status: { draft: "טיוטה", ordered: "הוזמן", received: "התקבל", cancelled: "בוטל" },
  movement_type: { purchase: "רכישה", consumption: "צריכה", adjustment: "תיאום", return: "החזרה", waste: "בלאי" },
  campaign_status: { draft: "טיוטה", scheduled: "מתוזמן", running: "פעיל", completed: "הושלם", cancelled: "בוטל" },
  lead_status: { new: "חדש", contacted: "נוצר קשר", scheduled: "נקבע תור", converted: "הומר", lost: "אבוד" },
  subscription_status: { active: "פעיל", paused: "מושהה", cancelled: "בוטל", expired: "פג" },
  deposit_status: { pending: "ממתין", paid: "שולם", refunded: "הוחזר", forfeited: "חולט" },
  risk_level: { low: "נמוך", medium: "בינוני", high: "גבוה" },
  loyalty_txn: { earn: "צבירה", redeem: "מימוש", expire: "פקיעה", adjust: "תיאום" },
  channel: { whatsapp: "וואטסאפ", sms: "סמס", email: "אימייל", instagram: "אינסטגרם", facebook: "פייסבוק", tiktok: "טיקטוק", google: "גוגל", website: "אתר", phone: "טלפון", walk_in: "מזדמן" },
  direction: { inbound: "נכנס", outbound: "יוצא" },
  prediction: { color_fade: "דהיית צבע", root_growth: "צמיחת שורשים", repair_due: "תיקון נדרש", rebook_due: "חידוש תור", product_match: "התאמת מוצר" },
  waitlist: { waiting: "ממתין", offered: "הוצע", accepted: "התקבל", expired: "פג", cancelled: "בוטל" },
  dow: { 0: "ראשון", 1: "שני", 2: "שלישי", 3: "רביעי", 4: "חמישי", 5: "שישי", 6: "שבת" },
  period: { daily: "יומי", monthly: "חודשי" },
  adj: { percent: "אחוז", fixed: "סכום קבוע" },
  opp_status: { suggested: "הוצע", sent: "נשלח", converted: "נמכר", dismissed: "נדחה" },
};
const heMap = (m, v) => v == null ? '<span class="muted-cell">—</span>' : esc((MAPS[m] || {})[v] ?? v);
const enumOpts = (m, keys) => keys.map((k) => ({ value: k, label: MAPS[m][k] }));

// =====================================================================
// Block definitions — every view is a list of table blocks.
// A block with `edit` gets an "+ add" button and per-row "edit".
// =====================================================================
const VIEW_BLOCKS = {
  inventory: [
    { table: "inventory_items", title: "מלאי נוכחי", order: ["quantity", true],
      select: "id,quantity,reorder_level,unit,products(name,category,sku,cost_price,retail_price,suppliers(name))",
      cols: [
        { l: "מוצר", r: (r) => esc(r.products?.name) },
        { l: "קטגוריה", r: (r) => heMap("pcat", r.products?.category) },
        { l: 'מק"ט', r: (r) => dash(r.products?.sku) },
        { l: "במלאי", r: (r) => `<span class="num">${r.quantity}</span> ${esc(r.unit || "")} ${r.quantity <= r.reorder_level ? '<span class="pill pill--low">נמוך</span>' : '<span class="pill pill--ok">תקין</span>'}` },
        { l: "סף הזמנה", r: (r) => numCell(r.reorder_level) },
        { l: "עלות", r: (r) => money(r.products?.cost_price) },
        { l: "מחיר מכירה", r: (r) => money(r.products?.retail_price) },
        { l: "ספק", r: (r) => dash(r.products?.suppliers?.name) },
      ],
      edit: { title: "מלאי", fields: [
        { name: "quantity", label: "כמות", type: "number", step: "0.01" },
        { name: "reorder_level", label: "סף הזמנה", type: "number", step: "0.01" },
        { name: "unit", label: "יחידה", type: "text" },
      ] } },
    { table: "products", title: "קטלוג מוצרים", order: ["name", true],
      select: "id,name,sku,category,is_retail,retail_price,cost_price,is_active,supplier_id,suppliers(name)",
      cols: [
        { l: "שם", r: (r) => esc(r.name) },
        { l: 'מק"ט', r: (r) => dash(r.sku) },
        { l: "קטגוריה", r: (r) => heMap("pcat", r.category) },
        { l: "ספק", r: (r) => dash(r.suppliers?.name) },
        { l: "מחיר מכירה", r: (r) => money(r.retail_price) },
        { l: "עלות", r: (r) => money(r.cost_price) },
        { l: "למכירה", r: (r) => boolPill(r.is_retail) },
        { l: "פעיל", r: (r) => activePill(r.is_active) },
      ],
      edit: { title: "מוצר", fields: [
        { name: "name", label: "שם", type: "text", required: true },
        { name: "sku", label: 'מק"ט', type: "text" },
        { name: "category", label: "קטגוריה", type: "text" },
        { name: "supplier_id", label: "ספק", type: "fk", from: { table: "suppliers", labelField: "name" } },
        { name: "retail_price", label: "מחיר מכירה", type: "number", step: "0.01" },
        { name: "cost_price", label: "עלות", type: "number", step: "0.01" },
        { name: "is_retail", label: "ניתן למכירה ללקוח", type: "checkbox" },
        { name: "is_active", label: "פעיל", type: "checkbox", default: true },
      ] } },
    { table: "inventory_movements", title: "תנועות מלאי", order: ["created_at", false],
      select: "id,movement_type,quantity,notes,created_at,products(name)",
      cols: [
        { l: "מוצר", r: (r) => esc(r.products?.name) },
        { l: "סוג", r: (r) => heMap("movement_type", r.movement_type) },
        { l: "כמות", r: (r) => numCell(r.quantity) },
        { l: "הערה", r: (r) => trunc(r.notes) },
        { l: "תאריך", r: (r) => dtHe(r.created_at) },
      ] },
    { table: "purchase_orders", title: "הזמנות רכש", order: ["created_at", false],
      select: "id,status,ordered_at,received_at,total,suppliers(name)",
      cols: [
        { l: "ספק", r: (r) => dash(r.suppliers?.name) },
        { l: "סטטוס", r: (r) => heMap("po_status", r.status) },
        { l: "הוזמן", r: (r) => dateHe(r.ordered_at) },
        { l: "התקבל", r: (r) => dateHe(r.received_at) },
        { l: 'סה"כ', r: (r) => money(r.total) },
      ] },
    { table: "suppliers", title: "ספקים", order: ["name", true],
      select: "id,name,contact_name,phone,email",
      cols: [
        { l: "שם", r: (r) => esc(r.name) },
        { l: "איש קשר", r: (r) => dash(r.contact_name) },
        { l: "טלפון", r: (r) => dash(r.phone) },
        { l: "אימייל", r: (r) => dash(r.email) },
      ],
      edit: { title: "ספק", fields: [
        { name: "name", label: "שם", type: "text", required: true },
        { name: "contact_name", label: "איש קשר", type: "text" },
        { name: "phone", label: "טלפון", type: "text" },
        { name: "email", label: "אימייל", type: "text" },
      ] } },
  ],

  services: [
    { table: "services", title: "שירותים", order: ["name", true],
      select: "id,name,base_price,duration_minutes,deposit_amount,material_cost,requires_deposit,is_active,category_id,service_categories(name)",
      cols: [
        { l: "שירות", r: (r) => esc(r.name) },
        { l: "קטגוריה", r: (r) => dash(r.service_categories?.name) },
        { l: "משך", r: (r) => `<span class="num">${r.duration_minutes}</span> דק׳` },
        { l: "מחיר", r: (r) => money(r.base_price) },
        { l: "עלות חומרים", r: (r) => money(r.material_cost) },
        { l: "מקדמה", r: (r) => r.deposit_amount ? money(r.deposit_amount) : '<span class="muted-cell">—</span>' },
        { l: "פעיל", r: (r) => activePill(r.is_active) },
      ],
      edit: { title: "שירות", fields: [
        { name: "name", label: "שם", type: "text", required: true },
        { name: "category_id", label: "קטגוריה", type: "fk", from: { table: "service_categories", labelField: "name" } },
        { name: "duration_minutes", label: "משך (דקות)", type: "number" },
        { name: "base_price", label: "מחיר", type: "number", step: "0.01" },
        { name: "material_cost", label: "עלות חומרים", type: "number", step: "0.01" },
        { name: "requires_deposit", label: "דורש מקדמה", type: "checkbox" },
        { name: "deposit_amount", label: "סכום מקדמה", type: "number", step: "0.01" },
        { name: "is_active", label: "פעיל", type: "checkbox", default: true },
      ] } },
    { table: "service_categories", title: "קטגוריות", order: ["name", true],
      select: "id,name",
      cols: [{ l: "שם", r: (r) => esc(r.name) }],
      edit: { title: "קטגוריה", fields: [{ name: "name", label: "שם", type: "text", required: true }] } },
    { table: "pricing_rules", title: "כללי תמחור דינמי", order: ["created_at", false],
      select: "id,name,service_id,day_of_week,start_time,end_time,adjustment_type,adjustment_value,applies_to_tier,is_active,services(name)",
      cols: [
        { l: "שם", r: (r) => esc(r.name) },
        { l: "שירות", r: (r) => r.services?.name ? esc(r.services.name) : '<span class="muted-cell">כל השירותים</span>' },
        { l: "יום", r: (r) => r.day_of_week == null ? '<span class="muted-cell">כל יום</span>' : heMap("dow", r.day_of_week) },
        { l: "שעות", r: (r) => r.start_time && r.end_time ? `${String(r.start_time).slice(0, 5)}–${String(r.end_time).slice(0, 5)}` : '<span class="muted-cell">כל היום</span>' },
        { l: "התאמה", r: (r) => r.adjustment_type === "fixed" ? `₪${r.adjustment_value}` : `${r.adjustment_value}%` },
        { l: "דרגה", r: (r) => dash(r.applies_to_tier) },
        { l: "פעיל", r: (r) => activePill(r.is_active) },
      ],
      edit: { title: "כלל תמחור", fields: [
        { name: "name", label: "שם הכלל", type: "text", required: true },
        { name: "service_id", label: "שירות (ריק = כל השירותים)", type: "fk", from: { table: "services", labelField: "name" } },
        { name: "day_of_week", label: "יום בשבוע", type: "select", numeric: true, options: [
          { value: 0, label: "ראשון" }, { value: 1, label: "שני" }, { value: 2, label: "שלישי" },
          { value: 3, label: "רביעי" }, { value: 4, label: "חמישי" }, { value: 5, label: "שישי" }, { value: 6, label: "שבת" },
        ] },
        { name: "start_time", label: "משעה", type: "time" },
        { name: "end_time", label: "עד שעה", type: "time" },
        { name: "adjustment_type", label: "סוג התאמה", type: "select", options: [
          { value: "percent", label: "אחוז (%)" }, { value: "fixed", label: "סכום קבוע (₪)" },
        ] },
        { name: "adjustment_value", label: "ערך (שלילי = הנחה)", type: "number", step: "0.01" },
        { name: "applies_to_tier", label: "דרגת נאמנות (ריק = כולם)", type: "select", options: [
          { value: "silver", label: "Silver" }, { value: "gold", label: "Gold" }, { value: "platinum", label: "Platinum" },
        ] },
        { name: "is_active", label: "פעיל", type: "checkbox", default: true },
      ] } },
  ],

  hours: [
    { table: "business_hours", title: "שעות פעילות המספרה", order: ["day_of_week", true],
      select: "id,day_of_week,open_time,close_time,is_closed,branch_id",
      cols: [
        { l: "יום", r: (r) => heMap("dow", r.day_of_week) },
        { l: "פתיחה", r: (r) => r.is_closed ? '<span class="muted-cell">—</span>' : String(r.open_time).slice(0, 5) },
        { l: "סגירה", r: (r) => r.is_closed ? '<span class="muted-cell">—</span>' : String(r.close_time).slice(0, 5) },
        { l: "סטטוס", r: (r) => r.is_closed ? '<span class="pill pill--off">סגור</span>' : '<span class="pill pill--ok">פתוח</span>' },
      ],
      edit: { title: "שעות יום", fields: [
        { name: "day_of_week", label: "יום בשבוע", type: "select", numeric: true, options: [
          { value: 0, label: "ראשון" }, { value: 1, label: "שני" }, { value: 2, label: "שלישי" },
          { value: 3, label: "רביעי" }, { value: 4, label: "חמישי" }, { value: 5, label: "שישי" }, { value: 6, label: "שבת" },
        ] },
        { name: "open_time", label: "שעת פתיחה", type: "time" },
        { name: "close_time", label: "שעת סגירה", type: "time" },
        { name: "is_closed", label: "סגור ביום זה", type: "checkbox" },
      ] } },
    { table: "staff_hours", title: "שעות עבודה לפי ספר", order: ["staff_id", true],
      select: "id,staff_id,day_of_week,start_time,end_time,is_off,staff(full_name)",
      cols: [
        { l: "ספר", r: (r) => esc(r.staff?.full_name) },
        { l: "יום", r: (r) => heMap("dow", r.day_of_week) },
        { l: "פתיחה", r: (r) => r.is_off ? '<span class="muted-cell">—</span>' : String(r.start_time).slice(0, 5) },
        { l: "סגירה", r: (r) => r.is_off ? '<span class="muted-cell">—</span>' : String(r.end_time).slice(0, 5) },
        { l: "סטטוס", r: (r) => r.is_off ? '<span class="pill pill--off">חופש</span>' : '<span class="pill pill--ok">עובד</span>' },
      ],
      edit: { title: "שעות עבודה", fields: [
        { name: "staff_id", label: "ספר", type: "fk", from: { table: "staff", labelField: "full_name" }, required: true },
        { name: "day_of_week", label: "יום בשבוע", type: "select", numeric: true, options: [
          { value: 0, label: "ראשון" }, { value: 1, label: "שני" }, { value: 2, label: "שלישי" },
          { value: 3, label: "רביעי" }, { value: 4, label: "חמישי" }, { value: 5, label: "שישי" }, { value: 6, label: "שבת" },
        ] },
        { name: "start_time", label: "שעת התחלה", type: "time" },
        { name: "end_time", label: "שעת סיום", type: "time" },
        { name: "is_off", label: "יום חופש (לא עובד)", type: "checkbox" },
      ] } },
    { table: "staff_breaks", title: "הפסקות צוות", order: ["staff_id", true],
      select: "id,staff_id,day_of_week,start_time,end_time,note,staff(full_name)",
      cols: [
        { l: "ספר", r: (r) => esc(r.staff?.full_name) },
        { l: "יום", r: (r) => r.day_of_week == null ? '<span class="muted-cell">כל יום</span>' : heMap("dow", r.day_of_week) },
        { l: "משעה", r: (r) => String(r.start_time).slice(0, 5) },
        { l: "עד שעה", r: (r) => String(r.end_time).slice(0, 5) },
        { l: "הערה", r: (r) => dash(r.note) },
      ],
      edit: { title: "הפסקה", fields: [
        { name: "staff_id", label: "ספר", type: "fk", from: { table: "staff", labelField: "full_name" }, required: true },
        { name: "day_of_week", label: "יום (ריק = כל יום)", type: "select", numeric: true, options: [
          { value: 0, label: "ראשון" }, { value: 1, label: "שני" }, { value: 2, label: "שלישי" },
          { value: 3, label: "רביעי" }, { value: 4, label: "חמישי" }, { value: 5, label: "שישי" }, { value: 6, label: "שבת" },
        ] },
        { name: "start_time", label: "משעה", type: "time" },
        { name: "end_time", label: "עד שעה", type: "time" },
        { name: "note", label: "הערה", type: "text" },
      ] } },
  ],

  staff: [
    { table: "staff", title: "אנשי צוות", order: ["full_name", true],
      select: "id,full_name,email,phone,commission_rate,hourly_cost,is_active,role_id,roles(name)",
      cols: [
        { l: "שם", r: (r) => esc(r.full_name) },
        { l: "תפקיד", r: (r) => heMap("role", r.roles?.name) },
        { l: "טלפון", r: (r) => dash(r.phone) },
        { l: "אימייל", r: (r) => dash(r.email) },
        { l: "עמלה", r: (r) => r.commission_rate != null ? `<span class="num">${r.commission_rate}%</span>` : '<span class="muted-cell">—</span>' },
        { l: "עלות/שעה", r: (r) => money(r.hourly_cost) },
        { l: "סטטוס", r: (r) => r.is_active ? '<span class="pill pill--ok">פעיל</span>' : '<span class="pill pill--off">לא פעיל</span>' },
      ],
      edit: { title: "איש צוות", fields: [
        { name: "full_name", label: "שם מלא", type: "text", required: true },
        { name: "role_id", label: "תפקיד", type: "fk", from: { table: "roles", labelField: "name", labelMap: (v) => MAPS.role[v] || v } },
        { name: "phone", label: "טלפון", type: "text" },
        { name: "email", label: "אימייל", type: "text" },
        { name: "commission_rate", label: "עמלה (%)", type: "number", step: "0.01" },
        { name: "hourly_cost", label: "עלות לשעה", type: "number", step: "0.01" },
        { name: "is_active", label: "פעיל", type: "checkbox", default: true },
      ] } },
    { table: "staff_shifts", title: "משמרות", order: ["starts_at", false],
      select: "id,starts_at,ends_at,notes,staff(full_name)",
      cols: [
        { l: "עובד", r: (r) => esc(r.staff?.full_name) },
        { l: "התחלה", r: (r) => dtHe(r.starts_at) },
        { l: "סיום", r: (r) => dtHe(r.ends_at) },
        { l: "הערה", r: (r) => dash(r.notes) },
      ] },
    { table: "staff_time_off", title: "חופשות", order: ["starts_at", false],
      select: "id,starts_at,ends_at,reason,approved,staff(full_name)",
      cols: [
        { l: "עובד", r: (r) => esc(r.staff?.full_name) },
        { l: "מתאריך", r: (r) => dateHe(r.starts_at) },
        { l: "עד", r: (r) => dateHe(r.ends_at) },
        { l: "סיבה", r: (r) => dash(r.reason) },
        { l: "מאושר", r: (r) => boolPill(r.approved) },
      ] },
    { table: "staff_goals", title: "יעדי צוות", order: ["period_start", false],
      select: "id,period_start,period_end,revenue_target,product_sales_target,staff(full_name)",
      cols: [
        { l: "עובד", r: (r) => esc(r.staff?.full_name) },
        { l: "מתאריך", r: (r) => dateHe(r.period_start) },
        { l: "עד", r: (r) => dateHe(r.period_end) },
        { l: "יעד הכנסה", r: (r) => money(r.revenue_target) },
        { l: "יעד מוצרים", r: (r) => money(r.product_sales_target) },
      ] },
  ],

  plans: [
    { table: "subscription_plans", title: "מנויים חודשיים", order: ["price_monthly", true],
      select: "id,name,price_monthly,is_active,benefits",
      cols: [
        { l: "תוכנית", r: (r) => esc(r.name) },
        { l: "מחיר חודשי", r: (r) => money(r.price_monthly) },
        { l: "הטבות", r: (r) => benefitsList(r.benefits) },
        { l: "פעיל", r: (r) => activePill(r.is_active) },
      ],
      edit: { title: "תוכנית מנוי", fields: [
        { name: "name", label: "שם", type: "text", required: true },
        { name: "price_monthly", label: "מחיר חודשי", type: "number", step: "0.01" },
        { name: "is_active", label: "פעיל", type: "checkbox", default: true },
      ] } },
    { table: "loyalty_tiers", title: "דרגות נאמנות", order: ["min_points", true],
      select: "id,name,min_points,benefits",
      cols: [
        { l: "דרגה", r: (r) => esc(r.name) },
        { l: "נקודות מינימום", r: (r) => numCell(r.min_points) },
        { l: "הטבות", r: (r) => benefitsList(r.benefits) },
      ] },
    { table: "client_subscriptions", title: "מנויים פעילים", order: ["created_at", false],
      select: "id,status,started_at,renews_at,clients(full_name),subscription_plans(name)",
      cols: [
        { l: "לקוח", r: (r) => esc(r.clients?.full_name) },
        { l: "תוכנית", r: (r) => dash(r.subscription_plans?.name) },
        { l: "סטטוס", r: (r) => heMap("subscription_status", r.status) },
        { l: "התחיל", r: (r) => dateHe(r.started_at) },
        { l: "מתחדש", r: (r) => dateHe(r.renews_at) },
      ] },
    { table: "loyalty_transactions", title: "תנועות נאמנות", order: ["created_at", false],
      select: "id,txn_type,points,reason,created_at,loyalty_accounts(clients(full_name))",
      cols: [
        { l: "לקוח", r: (r) => dash(r.loyalty_accounts?.clients?.full_name) },
        { l: "סוג", r: (r) => heMap("loyalty_txn", r.txn_type) },
        { l: "נקודות", r: (r) => numCell(r.points) },
        { l: "סיבה", r: (r) => dash(r.reason) },
        { l: "תאריך", r: (r) => dtHe(r.created_at) },
      ] },
  ],

  finance: [
    { table: "invoices", title: "חשבוניות", order: ["created_at", false],
      select: "id,status,subtotal,discount,tax,total,issued_at,clients(full_name)",
      cols: [
        { l: "לקוח", r: (r) => esc(r.clients?.full_name) },
        { l: "סטטוס", r: (r) => heMap("invoice_status", r.status) },
        { l: "ביניים", r: (r) => money(r.subtotal) },
        { l: "הנחה", r: (r) => money(r.discount) },
        { l: 'מע"מ', r: (r) => money(r.tax) },
        { l: 'סה"כ', r: (r) => money(r.total) },
        { l: "הופקה", r: (r) => dateHe(r.issued_at) },
      ] },
    { table: "payments", title: "תשלומים", order: ["paid_at", false],
      select: "id,amount,method,paid_at,clients(full_name),staff(full_name)",
      cols: [
        { l: "לקוח", r: (r) => dash(r.clients?.full_name) },
        { l: "סכום", r: (r) => money(r.amount) },
        { l: "אמצעי", r: (r) => heMap("payment_method", r.method) },
        { l: "עובד", r: (r) => dash(r.staff?.full_name) },
        { l: "תאריך", r: (r) => dtHe(r.paid_at) },
      ] },
    { table: "deposits", title: "מקדמות", order: ["created_at", false],
      select: "id,amount,status,paid_at,clients(full_name)",
      cols: [
        { l: "לקוח", r: (r) => esc(r.clients?.full_name) },
        { l: "סכום", r: (r) => money(r.amount) },
        { l: "סטטוס", r: (r) => heMap("deposit_status", r.status) },
        { l: "שולם", r: (r) => dtHe(r.paid_at) },
      ] },
  ],

  marketing: [
    { table: "marketing_campaigns", title: "קמפיינים", order: ["created_at", false],
      select: "id,name,channel,status,scheduled_at,message_template",
      cols: [
        { l: "שם", r: (r) => esc(r.name) },
        { l: "ערוץ", r: (r) => heMap("channel", r.channel) },
        { l: "סטטוס", r: (r) => heMap("campaign_status", r.status) },
        { l: "מתוזמן", r: (r) => dtHe(r.scheduled_at) },
        { l: "הודעה", r: (r) => trunc(r.message_template) },
      ] },
    { table: "campaign_recipients", title: "נמענים", order: ["created_at", false],
      select: "id,sent_at,responded,converted,marketing_campaigns(name),clients(full_name)",
      cols: [
        { l: "קמפיין", r: (r) => dash(r.marketing_campaigns?.name) },
        { l: "לקוח", r: (r) => dash(r.clients?.full_name) },
        { l: "נשלח", r: (r) => dtHe(r.sent_at) },
        { l: "הגיב", r: (r) => boolPill(r.responded) },
        { l: "המיר", r: (r) => boolPill(r.converted) },
      ] },
    { table: "leads", title: "לידים", order: ["created_at", false],
      select: "id,full_name,phone,email,source,status,notes",
      cols: [
        { l: "שם", r: (r) => dash(r.full_name) },
        { l: "טלפון", r: (r) => dash(r.phone) },
        { l: "אימייל", r: (r) => dash(r.email) },
        { l: "מקור", r: (r) => heMap("channel", r.source) },
        { l: "סטטוס", r: (r) => heMap("lead_status", r.status) },
        { l: "הערות", r: (r) => trunc(r.notes) },
      ],
      edit: { title: "ליד", fields: [
        { name: "full_name", label: "שם", type: "text" },
        { name: "phone", label: "טלפון", type: "text" },
        { name: "email", label: "אימייל", type: "text" },
        { name: "source", label: "מקור", type: "select", options: enumOpts("channel", ["instagram", "facebook", "tiktok", "google", "website", "phone", "whatsapp"]) },
        { name: "status", label: "סטטוס", type: "select", options: enumOpts("lead_status", ["new", "contacted", "scheduled", "converted", "lost"]) },
        { name: "notes", label: "הערות", type: "textarea" },
      ] } },
    { table: "reviews", title: "ביקורות", order: ["created_at", false],
      select: "id,rating,comment,submitted_at,clients(full_name),staff(full_name)",
      cols: [
        { l: "לקוח", r: (r) => dash(r.clients?.full_name) },
        { l: "עובד", r: (r) => dash(r.staff?.full_name) },
        { l: "דירוג", r: (r) => starsCell(r.rating) },
        { l: "תגובה", r: (r) => trunc(r.comment) },
        { l: "תאריך", r: (r) => dateHe(r.submitted_at) },
      ] },
    { table: "social_accounts", title: "רשתות חברתיות", order: ["platform", true],
      select: "id,platform,handle,is_connected",
      cols: [
        { l: "פלטפורמה", r: (r) => heMap("channel", r.platform) },
        { l: "כינוי", r: (r) => dash(r.handle) },
        { l: "מחובר", r: (r) => boolPill(r.is_connected) },
      ] },
    { table: "sales_opportunities", title: "הזדמנויות מכירה", order: ["created_at", false],
      select: "id,message,status,client_id,product_id,trigger_service_id,clients(full_name),products(name)",
      cols: [
        { l: "לקוח", r: (r) => esc(r.clients?.full_name) },
        { l: "מוצר", r: (r) => dash(r.products?.name) },
        { l: "הודעה", r: (r) => trunc(r.message) },
        { l: "סטטוס", r: (r) => heMap("opp_status", r.status) },
      ],
      edit: { title: "הזדמנות מכירה", fields: [
        { name: "client_id", label: "לקוח", type: "fk", from: { table: "clients", labelField: "full_name" }, required: true },
        { name: "product_id", label: "מוצר מומלץ", type: "fk", from: { table: "products", labelField: "name" } },
        { name: "trigger_service_id", label: "טיפול מפעיל", type: "fk", from: { table: "services", labelField: "name" } },
        { name: "message", label: "הודעת המלצה", type: "textarea" },
        { name: "status", label: "סטטוס", type: "select", options: [
          { value: "suggested", label: "הוצע" }, { value: "sent", label: "נשלח" },
          { value: "converted", label: "נמכר" }, { value: "dismissed", label: "נדחה" },
        ] },
      ] } },
  ],

  ai: [
    { table: "ai_recommendations", title: "המלצות AI", order: ["created_at", false],
      select: "id,category,title,body,estimated_value,is_dismissed",
      cols: [
        { l: "קטגוריה", r: (r) => dash(r.category) },
        { l: "כותרת", r: (r) => esc(r.title) },
        { l: "תוכן", r: (r) => trunc(r.body) },
        { l: "ערך משוער", r: (r) => money(r.estimated_value) },
        { l: "נדחה", r: (r) => boolPill(r.is_dismissed) },
      ] },
    { table: "cancellation_risks", title: "סיכוני ביטול", order: ["computed_at", false],
      select: "id,score,level,recommended_action,computed_at,clients(full_name)",
      cols: [
        { l: "לקוח", r: (r) => esc(r.clients?.full_name) },
        { l: "ציון", r: (r) => numCell(r.score) },
        { l: "רמה", r: (r) => riskPill(r.level) },
        { l: "פעולה מומלצת", r: (r) => trunc(r.recommended_action) },
        { l: "חושב", r: (r) => dtHe(r.computed_at) },
      ] },
    { table: "conversations", title: "שיחות", order: ["last_message_at", false],
      select: "id,channel,external_id,is_bot_active,last_message_at,clients(full_name)",
      cols: [
        { l: "לקוח", r: (r) => dash(r.clients?.full_name) },
        { l: "ערוץ", r: (r) => heMap("channel", r.channel) },
        { l: "מזהה חיצוני", r: (r) => dash(r.external_id) },
        { l: "בוט פעיל", r: (r) => boolPill(r.is_bot_active) },
        { l: "הודעה אחרונה", r: (r) => dtHe(r.last_message_at) },
      ] },
    { table: "messages", title: "הודעות", order: ["created_at", false],
      select: "id,direction,body,intent,sent_by_bot,created_at,conversations(clients(full_name))",
      cols: [
        { l: "לקוח", r: (r) => dash(r.conversations?.clients?.full_name) },
        { l: "כיוון", r: (r) => heMap("direction", r.direction) },
        { l: "תוכן", r: (r) => trunc(r.body) },
        { l: "כוונה", r: (r) => dash(r.intent) },
        { l: "בוט", r: (r) => boolPill(r.sent_by_bot) },
        { l: "זמן", r: (r) => dtHe(r.created_at) },
      ] },
    { table: "hair_simulations", title: "סימולציות שיער", order: ["created_at", false],
      select: "id,simulation_type,created_at,clients(full_name)",
      cols: [
        { l: "לקוח", r: (r) => dash(r.clients?.full_name) },
        { l: "סוג", r: (r) => dash(r.simulation_type) },
        { l: "תאריך", r: (r) => dtHe(r.created_at) },
      ] },
    { table: "hair_journey_predictions", title: "תחזיות מסע שיער", order: ["created_at", false],
      select: "id,prediction_type,predicted_date,resolved,clients(full_name)",
      cols: [
        { l: "לקוח", r: (r) => esc(r.clients?.full_name) },
        { l: "סוג", r: (r) => heMap("prediction", r.prediction_type) },
        { l: "צפוי", r: (r) => dateHe(r.predicted_date) },
        { l: "טופל", r: (r) => boolPill(r.resolved) },
      ] },
    { table: "business_targets", title: "יעדים עסקיים", order: ["target_date", false],
      select: "id,period,target_date,revenue_target",
      cols: [
        { l: "תקופה", r: (r) => heMap("period", r.period) },
        { l: "תאריך", r: (r) => dateHe(r.target_date) },
        { l: "יעד הכנסה", r: (r) => money(r.revenue_target) },
      ] },
    { table: "waitlist", title: "רשימת המתנה", order: ["priority", false],
      select: "id,status,priority,desired_from,desired_to,clients(full_name),services(name)",
      cols: [
        { l: "לקוח", r: (r) => esc(r.clients?.full_name) },
        { l: "שירות", r: (r) => dash(r.services?.name) },
        { l: "מ", r: (r) => dtHe(r.desired_from) },
        { l: "עד", r: (r) => dtHe(r.desired_to) },
        { l: "סטטוס", r: (r) => heMap("waitlist", r.status) },
        { l: "עדיפות", r: (r) => numCell(r.priority) },
      ] },
  ],
};

// =====================================================================
// Block rendering
// =====================================================================
const blockCache = {}; // "view:i" -> rows

function renderView(name) {
  const host = $("dd-" + name);
  const blocks = VIEW_BLOCKS[name] || [];
  host.innerHTML = blocks.map((b, i) => `
    <div class="block">
      <div class="block-head">
        <h3>${b.title}<span class="count" id="cnt-${name}-${i}"></span></h3>
        ${b.edit ? `<button class="add-btn" data-add="${name}:${i}">+ הוספה</button>` : ""}
      </div>
      <div class="table-wrap" id="tbl-${name}-${i}"><div class="loading-row">טוען…</div></div>
    </div>`).join("");
  blocks.forEach((b, i) => loadBlock(name, i, b));
}

async function loadBlock(name, i, b) {
  const tbl = $(`tbl-${name}-${i}`);
  let q = sb.from(b.table).select(b.select || "*").limit(b.limit || 200);
  if (b.order) q = q.order(b.order[0], { ascending: b.order[1] ?? false });
  const { data, error } = await q;
  if (error) { tbl.innerHTML = `<div class="empty">שגיאה: ${esc(error.message)}</div>`; return; }
  blockCache[`${name}:${i}`] = data;
  $(`cnt-${name}-${i}`).textContent = data.length ? ` (${data.length})` : "";
  if (!data.length) { tbl.innerHTML = '<div class="empty">אין נתונים</div>'; return; }
  const editTh = b.edit ? "<th></th>" : "";
  const thead = `<thead><tr>${b.cols.map((c) => `<th>${c.l}</th>`).join("")}${editTh}</tr></thead>`;
  const body = data.map((row, ri) => {
    const tds = b.cols.map((c) => `<td>${c.r(row)}</td>`).join("");
    const ed = b.edit ? `<td><button class="row-edit" data-edit="${name}:${i}:${ri}">עריכה</button></td>` : "";
    return `<tr>${tds}${ed}</tr>`;
  }).join("");
  tbl.innerHTML = `<table class="data">${thead}<tbody>${body}</tbody></table>`;
}

// =====================================================================
// Edit / create modal
// =====================================================================
const modal = $("modal");
let editCtx = null;

document.addEventListener("click", (e) => {
  const add = e.target.closest("[data-add]");
  if (add) { const [n, i] = add.dataset.add.split(":"); openEdit(n, +i, null); return; }
  const ed = e.target.closest("[data-edit]");
  if (ed) {
    const [n, i, ri] = ed.dataset.edit.split(":");
    openEdit(n, +i, (blockCache[`${n}:${i}`] || [])[+ri]);
  }
});
modal.querySelectorAll("[data-mclose]").forEach((n) => n.addEventListener("click", () => (modal.hidden = true)));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") modal.hidden = true; });

async function openEdit(name, i, row) {
  const block = VIEW_BLOCKS[name][i];
  const spec = block.edit;
  editCtx = { name, i, table: spec.table_name || block.table, id: row?.id || null };
  $("modalTitle").textContent = (row ? "עריכה — " : "הוספה — ") + spec.title;
  $("modalToast").className = "toast";
  const form = $("modalForm");
  form.innerHTML = '<div class="loading-row">טוען…</div>';
  modal.hidden = false;

  // resolve FK dropdown options (once per field)
  for (const f of spec.fields) {
    if (f.type === "fk" && !f._opts) {
      const { data } = await sb.from(f.from.table).select(`id, ${f.from.labelField}`).order(f.from.labelField);
      f._opts = (data || []).map((d) => ({
        value: d.id,
        label: f.from.labelMap ? f.from.labelMap(d[f.from.labelField]) : d[f.from.labelField],
      }));
    }
  }

  form.innerHTML = spec.fields.map((f) => fieldHtml(f, row)).join("") +
    `<button type="submit" class="btn"><span class="btn__label">${row ? "שמירה" : "הוספה"}</span><span class="btn__spinner" aria-hidden="true"></span></button>`;
}

function fieldHtml(f, row) {
  const id = "f_" + f.name;
  let v = row ? row[f.name] : f.default;
  if (f.type === "checkbox") {
    const checked = (v == null ? !!f.default : v) ? "checked" : "";
    return `<label class="field field--check"><input type="checkbox" id="${id}" ${checked}/> ${f.label}</label>`;
  }
  let input;
  if (f.type === "textarea") {
    input = `<textarea id="${id}" rows="3">${esc(v ?? "")}</textarea>`;
  } else if (f.type === "select" || f.type === "fk") {
    const opts = f.type === "fk" ? (f._opts || []) : f.options;
    const cur = v == null ? "" : String(v);
    input = `<div class="select-wrap"><select id="${id}" ${f.required ? "required" : ""}>` +
      `<option value="">—</option>` +
      opts.map((o) => `<option value="${esc(o.value)}" ${String(o.value) === cur ? "selected" : ""}>${esc(o.label)}</option>`).join("") +
      `</select></div>`;
  } else {
    let val = v == null ? "" : v;
    if (f.type === "date" && val) val = String(val).slice(0, 10);
    if (f.type === "time" && val) val = String(val).slice(0, 5);
    const step = f.step ? ` step="${f.step}"` : "";
    input = `<input type="${f.type}" id="${id}" value="${esc(val)}"${step} ${f.required ? "required" : ""}/>`;
  }
  return `<div class="field"><label for="${id}">${f.label}</label>${input}</div>`;
}

$("modalForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!editCtx) return;
  const spec = VIEW_BLOCKS[editCtx.name][editCtx.i].edit;
  const form = e.currentTarget;
  if (!form.checkValidity()) { form.reportValidity(); return; }

  const payload = {};
  for (const f of spec.fields) {
    const elx = $("f_" + f.name);
    if (!elx) continue;
    if (f.type === "checkbox") { payload[f.name] = elx.checked; continue; }
    let val = elx.value;
    if (val === "") { payload[f.name] = null; continue; }
    payload[f.name] = (f.type === "number" || f.numeric) ? Number(val) : val;
  }

  const btn = form.querySelector("button[type=submit]");
  btn.disabled = true; btn.classList.add("loading");
  const res = editCtx.id
    ? await sb.from(editCtx.table).update(payload).eq("id", editCtx.id)
    : await sb.from(editCtx.table).insert(payload);
  btn.disabled = false; btn.classList.remove("loading");

  if (res.error) {
    const t = $("modalToast");
    t.textContent = "שמירה נכשלה: " + res.error.message;
    t.className = "toast show err";
    return;
  }
  modal.hidden = true;
  toast(editCtx.id ? "עודכן בהצלחה" : "נוסף בהצלחה");
  loadBlock(editCtx.name, editCtx.i, VIEW_BLOCKS[editCtx.name][editCtx.i]);
});

// =====================================================================
// WhatsApp conversations (read + manual reply + reminders)
// =====================================================================
let waWired = false;
let waCurrent = null; // selected conversation row

function setWaMode(simulated) {
  const m = $("waMode");
  if (simulated == null) { m.innerHTML = ""; return; }
  m.className = "wa-mode" + (simulated ? "" : " live");
  m.innerHTML = simulated
    ? 'מצב: <b>סימולציה</b> (וואטסאפ לא מחובר)'
    : 'מצב: <b>שליחה פעילה</b>';
}

async function loadWhatsApp() {
  if (!waWired) {
    waWired = true;
    $("waRefresh").addEventListener("click", loadWhatsApp);
    $("waReminders").addEventListener("click", sendReminders);
    setWaMode(true); // assume simulation until a send proves otherwise
  }
  const list = $("waList");
  list.innerHTML = '<div class="loading-row">טוען…</div>';
  const { data, error } = await sb.from("conversations")
    .select("id, channel, external_id, last_message_at, clients(id, full_name, phone)")
    .order("last_message_at", { ascending: false, nullsFirst: false });
  if (error) { list.innerHTML = `<div class="empty">שגיאה: ${esc(error.message)}</div>`; return; }
  if (!data.length) { list.innerHTML = '<div class="empty">אין שיחות</div>'; return; }

  list.innerHTML = "";
  for (const conv of data) {
    const row = el("div", "wa-conv");
    if (waCurrent && conv.id === waCurrent.id) row.classList.add("is-active");
    row.innerHTML = `
      <div class="name">${esc(conv.clients?.full_name || conv.external_id || "לקוח/ה")}
        <span class="ch">${heMap("channel", conv.channel)}</span></div>
      <div class="last">${conv.last_message_at ? dtHe(conv.last_message_at) : "—"}</div>`;
    row.addEventListener("click", () => openConversation(conv));
    list.appendChild(row);
  }
}

async function openConversation(conv) {
  waCurrent = conv;
  document.querySelectorAll(".wa-conv").forEach((n) => n.classList.remove("is-active"));
  const thread = $("waThread");
  thread.innerHTML = '<div class="loading-row">טוען…</div>';
  loadWhatsApp(); // refresh list highlight

  const { data: msgs, error } = await sb.from("messages")
    .select("direction, body, intent, sent_by_bot, created_at")
    .eq("conversation_id", conv.id).order("created_at", { ascending: true });
  if (error) { thread.innerHTML = `<div class="empty">שגיאה: ${esc(error.message)}</div>`; return; }

  const name = conv.clients?.full_name || conv.external_id || "לקוח/ה";
  const phone = conv.clients?.phone || conv.external_id || "";
  const bubbles = (msgs || []).map((m) => `
    <div class="bubble ${m.direction === "inbound" ? "in" : "out"}">
      ${esc(m.body || "")}
      <span class="t">${dtHe(m.created_at)}${m.sent_by_bot ? '<span class="botpill">בוט</span>' : ""}</span>
    </div>`).join("") || '<div class="empty">אין הודעות עדיין</div>';

  const canReply = !!conv.clients?.id;
  thread.innerHTML = `
    <div class="wa-th-head">
      <div><div class="name">${esc(name)}</div><div class="ph">${esc(phone)}</div></div>
    </div>
    <div class="wa-msgs" id="waMsgs">${bubbles}</div>
    ${canReply ? `<div class="wa-reply">
      <input id="waInput" type="text" placeholder="כתוב הודעה…" autocomplete="off" />
      <button class="btn" id="waSend"><span class="btn__label">שליחה</span><span class="btn__spinner" aria-hidden="true"></span></button>
    </div>` : '<div class="wa-reply"><span class="ph" style="padding:8px">ללקוח אין מספר טלפון לשליחה</span></div>'}`;

  const msgsBox = $("waMsgs");
  msgsBox.scrollTop = msgsBox.scrollHeight;

  if (canReply) {
    const send = async () => {
      const input = $("waInput");
      const text = input.value.trim();
      if (!text) return;
      const btn = $("waSend");
      btn.disabled = true; btn.classList.add("loading");
      try {
        const { data, error } = await sb.functions.invoke("send-message", {
          body: { client_id: conv.clients.id, text },
        });
        if (error) throw error;
        setWaMode(!!data?.simulated);
        input.value = "";
        openConversation(conv); // reload thread
      } catch (e) {
        toast("השליחה נכשלה", "err");
        btn.disabled = false; btn.classList.remove("loading");
      }
    };
    $("waSend").addEventListener("click", send);
    $("waInput").addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
  }
}

async function sendReminders() {
  const btn = $("waReminders");
  btn.disabled = true;
  try {
    const { data, error } = await sb.functions.invoke("send-reminders", { body: {} });
    if (error) throw error;
    setWaMode(!!data?.simulated);
    toast(`תזכורות: נשלחו ${data?.sent ?? 0}${data?.simulated ? " (סימולציה)" : ""}`);
    if (waCurrent) openConversation(waCurrent);
  } catch (e) {
    toast("שליחת תזכורות נכשלה", "err");
  } finally {
    btn.disabled = false;
  }
}

// =====================================================================
// Home / overview dashboard (KPIs + monthly goal + AI recs + today)
// =====================================================================
const shekel = (n) => "₪" + Math.round(n || 0).toLocaleString("en-US");

async function loadHome() {
  const box = $("homeBody");
  box.innerHTML = '<div class="loading-row">טוען…</div>';

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 864e5 - 1000);
  const weekEnd = new Date(todayStart.getTime() + 7 * 864e5);
  const d30 = new Date(now.getTime() - 30 * 864e5);
  const iso = (d) => d.toISOString();

  $("homeDate").textContent = now.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });

  const [pays, todays, upcoming, newClients, cancelled, total30, lowStockData, target, recs, risks] = await Promise.all([
    sb.from("payments").select("amount").gte("paid_at", iso(monthStart)),
    sb.from("appointments").select("id, starts_at, status, clients(full_name), appointment_services(services(name))").gte("starts_at", iso(todayStart)).lte("starts_at", iso(todayEnd)).order("starts_at", { ascending: true }),
    sb.from("appointments").select("total_price").gte("starts_at", iso(now)).lte("starts_at", iso(weekEnd)).in("status", ["pending", "confirmed", "arrived"]),
    sb.from("clients").select("id", { count: "exact", head: true }).gte("created_at", iso(monthStart)),
    sb.from("appointments").select("id", { count: "exact", head: true }).eq("status", "cancelled").gte("starts_at", iso(d30)),
    sb.from("appointments").select("id", { count: "exact", head: true }).gte("starts_at", iso(d30)),
    sb.from("inventory_items").select("quantity, reorder_level"),
    sb.from("business_targets").select("revenue_target").eq("period", "monthly").order("target_date", { ascending: false }).limit(1).maybeSingle(),
    sb.from("ai_recommendations").select("id, category, title, body, estimated_value").eq("is_dismissed", false).order("created_at", { ascending: false }).limit(6),
    sb.from("cancellation_risks").select("id", { count: "exact", head: true }).eq("level", "high"),
  ]);

  const revenue = (pays.data || []).reduce((s, p) => s + (+p.amount || 0), 0);
  const todayAppts = todays.data || [];
  const todayOk = todayAppts.filter((a) => ["confirmed", "arrived", "completed"].includes(a.status)).length;
  const expected = (upcoming.data || []).reduce((s, a) => s + (+a.total_price || 0), 0);
  const cancRate = total30.count ? Math.round((cancelled.count / total30.count) * 100) : 0;
  const lowStock = (lowStockData.data || []).filter((r) => r.quantity <= r.reorder_level).length;
  const monthTarget = target.data?.revenue_target || 0;
  const goalPct = monthTarget ? Math.min(100, Math.round((revenue / monthTarget) * 100)) : null;
  const recList = recs.data || [];

  const kpi = (v, k, sub, cls) =>
    `<div class="kpi ${cls || ""}"><div class="v">${v}</div><div class="k">${k}</div>${sub ? `<div class="sub">${sub}</div>` : ""}</div>`;

  box.innerHTML = `
    <div class="kpis">
      ${kpi(shekel(revenue), "הכנסות החודש", monthTarget ? `יעד ${shekel(monthTarget)}` : "", "kpi--accent")}
      ${kpi(todayAppts.length, "תורים היום", `${todayOk} מאושרים`)}
      ${kpi(shekel(expected), "הכנסה צפויה (7 ימים)")}
      ${kpi(newClients.count || 0, "לקוחות חדשים החודש")}
      ${kpi(cancRate + "%", "שיעור ביטולים (30 ימים)", "", cancRate >= 20 ? "kpi--warn" : "")}
      ${kpi(lowStock, "מוצרים במלאי נמוך", "", lowStock ? "kpi--warn" : "")}
    </div>

    ${monthTarget ? `<div class="goal">
      <div class="goal__head"><span>יעד הכנסה חודשי</span><span><b>${goalPct}%</b> · ${shekel(revenue)} / ${shekel(monthTarget)}</span></div>
      <div class="goal__bar"><span style="width:${goalPct}%"></span></div>
    </div>` : ""}

    <div class="home-cols">
      <div class="home-col">
        <h3 class="sub-head">המלצות AI ${risks.count ? `· <span class="risk-flag">${risks.count} סיכוני ביטול גבוהים</span>` : ""}</h3>
        ${recList.length ? recList.map(recCard).join("") : '<div class="empty">אין המלצות פעילות</div>'}
      </div>
      <div class="home-col">
        <h3 class="sub-head">לוח היום</h3>
        ${todayAppts.length ? todayAppts.map(todayRow).join("") : '<div class="empty">אין תורים היום</div>'}
      </div>
    </div>`;
}

function recCard(r) {
  return `<div class="rec-card">
    <div class="rec-top"><b>${esc(r.title || "המלצה")}</b>${r.estimated_value ? `<span class="rec-val">${shekel(r.estimated_value)}</span>` : ""}</div>
    <div class="rec-body">${esc(r.body || "")}</div>
    <button class="row-edit" data-dismiss="${r.id}">סגירת המלצה</button>
  </div>`;
}

function todayRow(a) {
  const svc = (a.appointment_services || []).map((r) => r.services?.name).filter(Boolean).join(", ") || "—";
  return `<div class="today-row">
    <span class="t">${fmtTime(a.starts_at)}</span>
    <span class="nm">${esc(a.clients?.full_name || "לקוח/ה")}<span class="sv">${esc(svc)}</span></span>
    <span class="badge badge--${a.status}">${STATUS_HE[a.status] || a.status}</span>
  </div>`;
}

document.addEventListener("click", (e) => {
  const d = e.target.closest("[data-dismiss]");
  if (d) dismissRec(d.dataset.dismiss);
});
async function dismissRec(id) {
  const { error } = await sb.from("ai_recommendations").update({ is_dismissed: true }).eq("id", id);
  if (error) { toast("הפעולה נכשלה", "err"); return; }
  toast("ההמלצה נסגרה");
  loadHome();
}

// upsell opportunity actions (in the client card)
document.addEventListener("click", (e) => {
  const cv = e.target.closest("[data-opp-convert]");
  if (cv) { setOpp(cv.dataset.oppConvert, "converted"); return; }
  const ds = e.target.closest("[data-opp-dismiss]");
  if (ds) setOpp(ds.dataset.oppDismiss, "dismissed");
});
async function setOpp(id, status) {
  const { error } = await sb.from("sales_opportunities").update({ status }).eq("id", id);
  if (error) { toast("הפעולה נכשלה", "err"); return; }
  toast(status === "converted" ? "סומן כנמכר 🎉" : "ההזדמנות נדחתה");
  if (currentClientId) openClient(currentClientId);
}

// =====================================================================
// Reviews & reputation
// =====================================================================
async function loadReviews() {
  const box = $("reviewsBody");
  box.innerHTML = '<div class="loading-row">טוען…</div>';
  const { data, error } = await sb.from("reviews")
    .select("id, rating, comment, submitted_at, requested_at, external_url, clients(full_name), staff(full_name)")
    .order("created_at", { ascending: false });
  if (error) { box.innerHTML = `<div class="empty">שגיאה: ${esc(error.message)}</div>`; return; }

  const all = data || [];
  const submitted = all.filter((r) => r.rating != null);
  const pending = all.filter((r) => r.rating == null && r.requested_at);
  const n = submitted.length;
  const avg = n ? submitted.reduce((s, r) => s + r.rating, 0) / n : 0;
  const dist = [0, 0, 0, 0, 0]; // index 0 => 1★ … index 4 => 5★
  submitted.forEach((r) => { if (r.rating >= 1 && r.rating <= 5) dist[r.rating - 1]++; });

  $("revAvg").textContent = n ? `${avg.toFixed(1)} ★ · ${n} ביקורות` : "אין ביקורות עדיין";

  const distRows = [5, 4, 3, 2, 1].map((star) => {
    const c = dist[star - 1];
    const pct = n ? Math.round((c / n) * 100) : 0;
    return `<div class="rev-dist-row"><span class="s">${star}★</span>
      <span class="rev-bar"><span style="width:${pct}%"></span></span>
      <span class="c">${c}</span></div>`;
  }).join("");

  const card = (r) => `<div class="rev-card">
    <div class="rev-card__top">
      <span class="stars">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</span>
      <span class="rev-when">${dateHe(r.submitted_at)}</span>
    </div>
    ${r.comment ? `<div class="rev-comment">"${esc(r.comment)}"</div>` : ""}
    <div class="rev-meta">${esc(r.clients?.full_name || "לקוח/ה")}${r.staff?.full_name ? " · " + esc(r.staff.full_name) : ""}</div>
  </div>`;

  const pendRow = (r) => `<div class="today-row">
    <span class="t">⏳</span>
    <span class="nm">${esc(r.clients?.full_name || "לקוח/ה")}<span class="sv">נשלחה בקשה · ${dateHe(r.requested_at)}</span></span>
    <span class="badge badge--pending">ממתין לתגובה</span>
  </div>`;

  box.innerHTML = `
    <div class="rev-summary">
      <div class="rev-avg">
        <div class="rev-avg__num">${n ? avg.toFixed(1) : "—"}</div>
        <div class="stars rev-avg__stars">${n ? "★".repeat(Math.round(avg)) + "☆".repeat(5 - Math.round(avg)) : "☆☆☆☆☆"}</div>
        <div class="rev-avg__count">${n} ביקורות</div>
      </div>
      <div class="rev-dist">${distRows}</div>
    </div>

    <div class="home-cols">
      <div class="home-col">
        <h3 class="sub-head">ביקורות שהתקבלו</h3>
        ${submitted.length ? submitted.map(card).join("") : '<div class="empty">אין ביקורות עדיין</div>'}
      </div>
      <div class="home-col">
        <h3 class="sub-head">ממתינות לתגובה (${pending.length})</h3>
        ${pending.length ? pending.map(pendRow).join("") : '<div class="empty">אין בקשות פתוחות</div>'}
      </div>
    </div>`;
}

// =====================================================================
// Analytics — profitability & performance
// =====================================================================
let analyticsWired = false;
async function loadAnalytics() {
  if (!analyticsWired) {
    analyticsWired = true;
    $("anRange").addEventListener("change", loadAnalytics);
  }
  const box = $("analyticsBody");
  box.innerHTML = '<div class="loading-row">טוען…</div>';

  const days = Number($("anRange").value) || 90;
  const start = new Date(Date.now() - days * 864e5);

  const { data, error } = await sb.from("appointments")
    .select("id, starts_at, total_price, staff(full_name, commission_rate), appointment_services(price, services(name, material_cost))")
    .eq("status", "completed")
    .gte("starts_at", start.toISOString())
    .order("starts_at", { ascending: true });
  if (error) { box.innerHTML = `<div class="empty">שגיאה: ${esc(error.message)}</div>`; return; }

  const appts = data || [];
  let revenue = 0, material = 0, commission = 0;
  const byMonth = {}, byService = {}, byStaff = {};

  for (const a of appts) {
    const price = +a.total_price || 0;
    revenue += price;
    commission += price * ((a.staff?.commission_rate || 0) / 100);

    const mk = new Date(a.starts_at).toLocaleDateString("he-IL", { month: "short", year: "2-digit", timeZone: TZ });
    byMonth[mk] = (byMonth[mk] || 0) + price;

    const sname = a.staff?.full_name || "ללא ספר/ית";
    const st = byStaff[sname] || (byStaff[sname] = { revenue: 0, count: 0, commission: 0 });
    st.revenue += price; st.count++; st.commission += price * ((a.staff?.commission_rate || 0) / 100);

    for (const line of a.appointment_services || []) {
      const mc = +line.services?.material_cost || 0;
      material += mc;
      const nm = line.services?.name || "—";
      const sv = byService[nm] || (byService[nm] = { revenue: 0, count: 0, material: 0 });
      sv.revenue += (+line.price || 0); sv.count++; sv.material += mc;
    }
  }

  const grossProfit = revenue - material;
  const netProfit = revenue - material - commission;
  const avgTicket = appts.length ? revenue / appts.length : 0;

  // monthly chart (ordered by appearance, which is chronological)
  const monthKeys = Object.keys(byMonth);
  const maxMonth = Math.max(1, ...monthKeys.map((k) => byMonth[k]));
  const bars = monthKeys.map((k) =>
    `<div class="bar-col">
      <div class="val">${shekel(byMonth[k])}</div>
      <div class="bar" style="height:${Math.round((byMonth[k] / maxMonth) * 100)}%"></div>
      <div class="lbl">${esc(k)}</div>
    </div>`).join("") || '<div class="empty">אין נתונים בטווח</div>';

  // top services by revenue
  const svcList = Object.entries(byService).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 8);
  const maxSvc = Math.max(1, ...svcList.map(([, v]) => v.revenue));
  const svcBars = svcList.map(([name, v]) => {
    const margin = v.revenue ? Math.round(((v.revenue - v.material) / v.revenue) * 100) : 0;
    return `<div class="hbar">
      <div class="top"><span>${esc(name)} <span class="muted-cell">×${v.count}</span></span><span>${shekel(v.revenue)} · ${margin}% רווח</span></div>
      <div class="track"><span class="fill" style="width:${Math.round((v.revenue / maxSvc) * 100)}%"></span></div>
    </div>`;
  }).join("") || '<div class="empty">אין נתונים</div>';

  // staff performance table
  const staffList = Object.entries(byStaff).sort((a, b) => b[1].revenue - a[1].revenue);
  const staffRows = staffList.map(([name, v]) =>
    `<tr><td>${esc(name)}</td><td class="num">${v.count}</td><td class="num">${shekel(v.revenue)}</td>
      <td class="num">${shekel(v.revenue / v.count)}</td><td class="num">${shekel(v.commission)}</td></tr>`).join("");

  const kpi = (v, k, cls) => `<div class="kpi ${cls || ""}"><div class="v">${v}</div><div class="k">${k}</div></div>`;

  box.innerHTML = `
    <div class="kpis">
      ${kpi(shekel(revenue), "הכנסות", "kpi--accent")}
      ${kpi(appts.length, "תורים שהושלמו")}
      ${kpi(shekel(avgTicket), "ממוצע לתור")}
      ${kpi(shekel(material), "עלות חומרים", "kpi--warn")}
      ${kpi(shekel(commission), "עמלות צוות", "kpi--warn")}
      ${kpi(shekel(netProfit), "רווח נקי משוער", netProfit >= 0 ? "" : "kpi--warn")}
    </div>

    <div class="an-card">
      <h3 class="sub-head">הכנסות לפי חודש</h3>
      <div class="bars">${bars}</div>
    </div>

    <div class="home-cols">
      <div class="home-col">
        <h3 class="sub-head">שירותים מובילים (לפי הכנסה)</h3>
        ${svcBars}
      </div>
      <div class="home-col">
        <h3 class="sub-head">ביצועי צוות</h3>
        ${staffList.length ? `<div class="table-wrap"><table class="data">
          <thead><tr><th>ספר/ית</th><th>תורים</th><th>הכנסה</th><th>ממוצע</th><th>עמלה</th></tr></thead>
          <tbody>${staffRows}</tbody></table></div>` : '<div class="empty">אין נתונים</div>'}
      </div>
    </div>`;
}
