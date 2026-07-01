# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

SalonOS AI — a premium salon-management system (Hebrew, RTL). The product vision
(20 functional areas: smart booking, CRM, WhatsApp AI, dynamic pricing, loyalty,
inventory, profitability, AI business coach, etc.) is specified in
`salon_premium_system.md`. `salonos_build_prompt.md` is an *aspirational* MVP build
prompt (Next.js/NestJS/Electron/React Native, multi-tenant) — it does **not**
describe what is currently built. Treat both as product requirements, not as a
description of the code.

What is actually implemented today is a **Supabase backend** (Postgres schema +
RLS + triggers + Edge Functions) and a **vanilla HTML/CSS/JS booking frontend**.

## Architecture

- **Database** (`supabase/migrations/`) — ~40 tables covering all 20 spec areas,
  applied in timestamp order. Every table has `ENABLE`+`FORCE ROW LEVEL SECURITY`;
  the only policy grants `authenticated` full access. `anon` has **no** access;
  `service_role` bypasses RLS. Triggers auto-maintain `updated_at`, auto-create a
  loyalty account per client, sync loyalty balance/tier from transactions, and
  adjust stock from `inventory_movements`.
- **Edge Functions** (`supabase/functions/`, Deno + `jsr:@supabase/supabase-js`):
  - `book-appointment` — **public** (`verify_jwt=false`). `GET` returns
    services+staff; `GET ?slots=1&date&service_id[&staff_id]` computes real
    availability (opening hours, service duration, existing appointments, staff
    capacity) in `Asia/Jerusalem`; `POST` creates client + pending appointment
    with a re-check against double-booking. **Dynamic pricing**: on POST it
    applies active `pricing_rules` (via `_shared/pricing.ts` — matched by service/
    weekday/time-range/loyalty-tier; percent or fixed, may be negative) to the
    service base price using the slot's local day/time and the client's loyalty
    tier, stores the adjusted `total_price`, and returns `price`+`base_price`
    (the booking page shows the final price, struck base if discounted).
  - `whatsapp-webhook` — **public** (`verify_jwt=false`). Meta verification
    handshake + inbound ingestion. Now also **replies**: generates a reply (Claude
    via `_shared/ai.ts` when `ANTHROPIC_API_KEY` is set, else keyword
    `replyFor`) and **sends** it via `_shared/whatsapp.ts`, unless the
    conversation's `is_bot_active` is false (human takeover). Skips sending only
    the reply, still logs inbound.
  - `send-message` — **JWT-protected**. `{client_id, text, intent?}` → finds/
    creates the WhatsApp conversation, logs an outbound message, sends via
    `_shared/whatsapp.ts`. Called by the dashboard for manual replies and for
    appointment confirm/cancel notifications.
  - `send-reminders` — **JWT-protected**. Default (no params) targets **all of
    tomorrow's** confirmed/pending appointments (Asia/Jerusalem calendar day);
    `?hours=N` gives a rolling now..now+N window instead. Only rows with
    `reminder_sent_at IS NULL` are sent, then stamped (no double-send). Trigger
    manually from the dashboard, and it runs **automatically at 12:00
    Asia/Jerusalem (noon the day before)** via a `pg_cron` + `pg_net` job
    (`salonos-noon-reminders`, migration
    `20260622170000_reminders_noon_day_before.sql`). pg_cron runs in UTC, so the
    job fires at 09:00 & 10:00 UTC and gates the POST on local hour = 12 (correct
    across DST). It authenticates with the **public anon key** (a valid JWT, not a
    secret). To change timing, re-`cron.schedule('salonos-noon-reminders', …)`;
    to stop, `select cron.unschedule('salonos-noon-reminders')`.
  - `submit-review` — **public** (`verify_jwt=false`). Backs the client review
    page. `GET ?r=<reviewId>` validates the link (returns client name, salon,
    already-submitted flag); `POST {r,rating,comment}` fills the pre-created
    `reviews` row (only if `submitted_at IS NULL` — idempotent/anti-tamper) and,
    when `rating >= branches.review_gate_threshold` (default 4), returns
    `branches.google_review_url` so the page routes happy clients to Google.
  - `_shared/whatsapp.ts` — `sendWhatsApp(to, text)`: real WhatsApp Cloud API
    POST when `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` secrets are set,
    otherwise **simulation mode** (logs, returns `{simulated:true}`, no Meta
    call). Set the two secrets to flip to real delivery — no code change.
    `_shared/ai.ts` — `aiReply()` returns null without `ANTHROPIC_API_KEY`.
  - `cancellation-risk` — **JWT-protected**. Scores cancellation risk and may
    auto-create a deposit.
  - `_shared/cors.ts` (CORS + `json()` helper) and `_shared/supabase.ts`
    (`adminClient()` = service-role client) are shared by all functions.
- **Frontend** (`public/`) — static, RTL/Hebrew, no build step, no framework.
  - **Booking page** (`index.html` + `styles.css` + `app.js`) — public client
    booking; calls the public `book-appointment` function directly (no Supabase
    keys in the browser; writes go server-side via service-role). Function URL
    hardcoded in `public/app.js` (`API`).
  - **Review page** (`public/review/` — `index.html` + `review.js`, reuses
    `../styles.css`) — public 1-5 star + comment form opened from the WhatsApp
    link sent after a completed appointment (`/review/?r=<reviewId>`). Calls the
    public `submit-review` function; high ratings surface the salon's Google link.
    The dashboard creates the `reviews` row + sends the link when staff mark an
    appointment **completed** (`requestReview` in `admin.js`); the **ביקורות**
    view shows average/distribution + received reviews + pending requests.
    The **רווחיות** view (`loadAnalytics`) computes, over a selectable window
    (30/90/180/365d) from completed appointments: revenue, avg ticket, material
    cost, staff commission, net profit, a monthly revenue bar chart, top services
    by revenue+margin, and a staff-performance table — all pure CSS/SVG, no chart
    library.
  - **Manager dashboard** (`public/admin/` — `index.html` + `admin.css` +
    `admin.js`, ES module). Unlike the booking page, this signs in with **Supabase
    Auth using the public anon key** (loaded as a classic `<script>` →
    `window.supabase`, not an ESM import, so it works over http *and* `file://`)
    and queries tables **directly** from the browser, relying on the
    `authenticated` RLS policy (full access). The anon key is public by design.
    Custom views: a **home/overview** (default landing — `loadHome`): KPI cards
    (month revenue from `payments`, today's appointments, expected 7-day revenue,
    new clients this month, 30-day cancellation rate, low-stock count), a monthly
    revenue-goal bar (vs `business_targets` monthly), active `ai_recommendations`
    (dismissable → `is_dismissed`), and today's schedule; appointments list +
    status actions (confirm/arrived/completed/no-show/cancel, which stamp
    `confirmed_at`/`arrived_at`/`cancelled_at`),
    weekly calendar, client list + client-card drawer (loyalty, history, details,
    allergies, family, subscriptions, hair history). Plus **config-driven block
    views** (`VIEW_BLOCKS` in `admin.js`) covering every remaining table, grouped:
    inventory / services / staff / plans / finance / marketing / ai. Each block is
    `{table, select, order, cols}`; a block with an `edit` spec gets an "+ הוספה"
    button and per-row "עריכה" that open a generic modal (insert/update via the
    same RLS-backed client; FK fields load their options dynamically). Editable
    today: inventory_items, products, suppliers, services, service_categories,
    staff, subscription_plans, leads, pricing_rules (dynamic-pricing rules:
    service/day/time/tier + percent-or-fixed adjustment), sales_opportunities
    (upsell). The **client-card drawer** also shows that client's open upsell
    opportunities with נמכר/דחה actions (→ `sales_opportunities.status`).
    Marking an appointment **completed** auto-creates an upsell opportunity
    (`autoUpsell`) — a retail product matching the treatment (color/smoothing →
    shampoo/mask/conditioner, else highest-priced retail), de-duplicated against
    the client's open opportunities.
    Select/number coercion: edit fields support `type:"time"` and `numeric:true`
    selects. Requires a confirmed `auth.users` row to log
    in. Served locally via `python -m http.server 8000 --directory public` →
    `/admin/`. To add a view/table, add an entry to `VIEW_BLOCKS` and (if new) a
    nav `<button data-view>` + `<section id="view-…"><div id="dd-…">` in
    `index.html`. The **וואטסאפ** view is custom (not block-driven): a
    conversation list + thread + reply box that calls the `send-message`
    function (auto-uses the staff JWT via `sb.functions.invoke`), plus a
    "שליחת תזכורות" button (`send-reminders`). Confirming/cancelling an
    appointment also fires `send-message` to the client (`notifyClient`).

- **Demo data** — `migrations/20260622120000_seed_demo_data.sql` fills every
  otherwise-empty table with realistic Hebrew sample rows. Idempotent via a
  sentinel: it skips entirely if `ai_recommendations` already has rows.

- **Color formulas** — `migrations/20260622130000_client_color_formulas.sql` adds
  `client_formulas` (developer/oxygen vol+amount, mixing ratio, processing time,
  technique, application areas, result notes, performed_on, staff) and
  `client_formula_components` (one row per color in the mix: brand, shade_code,
  shade_name, amount) — so a formula can combine several colors. Both get the
  standard RLS policy; `client_formulas` gets the `set_updated_at` trigger
  explicitly (the global trigger loop only covered tables existing at the time).
  Surfaced in the client-card drawer ("פורמולות צבע") with a dedicated add/edit
  modal (`#fmodal` / `openFormula` in `admin.js`) that has repeatable color rows;
  saving replaces the formula's components.
- **Types** (`src/database.types.ts`) — generated from the live schema.

**Key design rule:** the browser never holds a Supabase key and never touches the
DB directly (RLS would block `anon` anyway). Any new client-facing write must go
through a public Edge Function that uses `adminClient()`. `verify_jwt` per function
is set in `supabase/config.toml` under `[functions.<name>]`.

## Project linkage & environment

- Linked Supabase project: **`hairapp`**, ref **`hdzmqoslaghgvydykixf`**
  (org `hairmang`). The CLI is authenticated.
- The DB password is at `~/hairapp-db-password.txt`; generated secrets at
  `~/hairapp-secrets.txt` (e.g. `WHATSAPP_VERIFY_TOKEN`). `SUPABASE_URL` and
  `SUPABASE_SERVICE_ROLE_KEY` are auto-injected into Edge Functions.
- **Docker is not available and not running here.** This means the local Supabase
  stack (`supabase start`, local `db reset`) and `psql` are **unavailable**. Work
  directly against the linked remote project. The `Warning: failed to cache
  migrations catalog ... docker` line after `db push`/`deploy` is benign — the
  remote operation still succeeds.

## Common commands (run from repo root, PowerShell)

```powershell
# All remote DB/migration commands need the password (link state is partial):
$pw = (Get-Content "$HOME\hairapp-db-password.txt" -Raw).Trim()

supabase db push --password $pw            # apply new migrations to remote
supabase migration list --password $pw     # verify Local vs Remote columns match

supabase functions deploy book-appointment # deploy one function (or list several)
supabase secrets set NAME=value            # set an Edge Function secret
```

### Adding a migration

Migrations must be named `<UTC-timestamp>_name.sql`. Generate the timestamp so
ordering is correct, then write the file and push:

```powershell
(Get-Date).ToString("yyyyMMddHHmmss")   # -> supabase/migrations/<ts>_name.sql
```

Make seed/DDL idempotent (`on conflict do nothing`, `where not exists`,
`drop ... if exists` before `create`) so re-runs are safe.

### Regenerating TypeScript types

```powershell
supabase gen types typescript --linked > "src\database.types.ts"
# PowerShell '>' writes UTF-16 — re-encode to UTF-8 afterwards:
$c = Get-Content "src\database.types.ts" -Raw
[System.IO.File]::WriteAllText((Resolve-Path "src\database.types.ts"), $c, (New-Object System.Text.UTF8Encoding $false))
```

## Verifying / querying without psql or Docker

There is no test suite. Verify changes by exercising the deployed functions and
querying via the REST API with the service-role key:

```powershell
$keys = supabase projects api-keys --project-ref hdzmqoslaghgvydykixf --output json | ConvertFrom-Json
$svc  = ($keys | Where-Object { $_.name -eq "service_role" }).api_key
$h    = @{ apikey = $svc; Authorization = "Bearer $svc" }
Invoke-RestMethod "https://hdzmqoslaghgvydykixf.supabase.co/rest/v1/clients?select=id" -Headers $h
```

Or use the dashboard SQL editor:
`https://supabase.com/dashboard/project/hdzmqoslaghgvydykixf`

**Sending Hebrew bodies from PowerShell:** `Invoke-RestMethod -Body "<json>"`
mangles UTF-8. Encode the body to bytes first:
`[System.Text.Encoding]::UTF8.GetBytes($json)` and pass
`-ContentType "application/json; charset=utf-8"`.

**Before deleting test rows, check what's actually there** — the live booking
form writes real client/appointment rows; don't delete real data when cleaning up
test artifacts.

## Conventions

- All user-facing strings are Hebrew; the frontend is RTL (`dir="rtl"`).
- Single-salon assumption in current code: functions pick the first `branches`
  row (`order by created_at limit 1`). The schema supports multi-branch.
- Opening hours / timezone live in `book-appointment/index.ts` (`HOURS`, `TZ`).
