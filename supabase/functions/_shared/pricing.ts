// =====================================================================
// Dynamic pricing engine (spec §7). Applies pricing_rules to a service's
// base price based on the appointment's weekday/time and the client's
// loyalty tier. Shared by the booking function (and mirrored client-side
// in the dashboard price calculator).
// =====================================================================
export interface PricingRule {
  name?: string | null;
  service_id?: string | null;
  day_of_week?: number | null;        // 0=Sun … 6=Sat, null = any day
  start_time?: string | null;         // 'HH:MM[:SS]', null = any time
  end_time?: string | null;
  adjustment_type: string;            // 'percent' | 'fixed'
  adjustment_value: number;           // may be negative (discount)
  applies_to_tier?: string | null;    // 'silver'|'gold'|'platinum', null = any
  is_active?: boolean;
}

const DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** weekday (0-6) and minutes-since-midnight for an instant, in a timezone. */
export function localDowMinutes(date: Date, tz: string): { dow: number; minutes: number } {
  const p: Record<string, string> = {};
  for (const x of new Intl.DateTimeFormat("en-US", {
    timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(date)) p[x.type] = x.value;
  return { dow: DOW[p.weekday] ?? 0, minutes: ((+p.hour % 24) * 60) + (+p.minute) };
}

const toMin = (t: string): number => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};

export interface PriceResult { base: number; price: number; applied: string[] }

/** Compute the effective price for a service given matching rules + context. */
export function applyPricing(
  base: number,
  rules: PricingRule[],
  ctx: { dow: number; minutes: number; tier?: string | null; serviceId?: string | null },
): PriceResult {
  let price = base;
  const applied: string[] = [];
  for (const r of rules) {
    if (r.is_active === false) continue;
    if (r.service_id && ctx.serviceId && r.service_id !== ctx.serviceId) continue;
    if (r.day_of_week != null && r.day_of_week !== ctx.dow) continue;
    if (r.start_time && r.end_time) {
      const s = toMin(r.start_time), e = toMin(r.end_time);
      if (!(ctx.minutes >= s && ctx.minutes < e)) continue;
    }
    if (r.applies_to_tier && r.applies_to_tier !== ctx.tier) continue;
    const delta = r.adjustment_type === "fixed"
      ? Number(r.adjustment_value)
      : base * (Number(r.adjustment_value) / 100);
    price += delta;
    if (r.name) applied.push(r.name);
  }
  return { base, price: Math.max(0, Math.round(price * 100) / 100), applied };
}
