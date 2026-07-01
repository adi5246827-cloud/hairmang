// =====================================================================
// Optional Claude-powered reply for the WhatsApp bot.
// Returns null when ANTHROPIC_API_KEY is not set, so callers fall back to
// the simple keyword replies. Set ANTHROPIC_API_KEY (and optionally
// ANTHROPIC_MODEL) to enable smart Hebrew replies.
// =====================================================================
const SYSTEM = `את/ה עוזר/ת וירטואלי/ת של מספרה ("SalonOS"). תפקידך לענות ללקוחות בוואטסאפ.
- ענה/י תמיד בעברית, בחום, בקצרה (1-3 משפטים) ובלשון מנומסת.
- אפשר לעזור ב: קביעת תור, שינוי/ביטול תור, מחירים, והמלצות מוצרים.
- אל תמציא/י מחירים, שעות פנויות או הבטחות ספציפיות — אם חסר מידע, הצע/י לבדוק מול הצוות ולחזור עם תשובה.
- אם הלקוח מבקש לקבוע/לשנות/לבטל תור, בקש/י את הפרטים החסרים (שירות, יום ושעה מועדפים).`;

export async function aiReply(
  userText: string,
  opts: { clientName?: string; history?: { role: "user" | "assistant"; content: string }[] } = {},
): Promise<string | null> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return null;
  const model = Deno.env.get("ANTHROPIC_MODEL") || "claude-haiku-4-5-20251001";

  const messages = [
    ...(opts.history ?? []),
    { role: "user" as const, content: userText },
  ];

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 400,
        system: opts.clientName ? `${SYSTEM}\nשם הלקוח/ה: ${opts.clientName}.` : SYSTEM,
        messages,
      }),
    });
    const data = await res.json();
    if (!res.ok) { console.error("anthropic error:", JSON.stringify(data)); return null; }
    const text = (data?.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("")
      .trim();
    return text || null;
  } catch (err) {
    console.error("aiReply error:", err);
    return null;
  }
}
