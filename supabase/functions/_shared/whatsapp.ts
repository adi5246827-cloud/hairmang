// =====================================================================
// WhatsApp Cloud API sender — two modes:
//   • real        when WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID are set
//   • simulation  otherwise — logs the message and returns {simulated:true}
//                 WITHOUT calling Meta, so the whole flow works before the
//                 business account is connected.
// Flip to real delivery by setting the two secrets — no code change needed.
// =====================================================================
export interface SendResult {
  ok: boolean;
  simulated: boolean;
  id?: string;
  error?: string;
}

/** Normalise an Israeli phone to international digits (0XX… -> 972XX…). */
export function toIntlPhone(raw: string): string {
  let d = (raw || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = "972" + d.slice(1);
  return d;
}

export function whatsappConfigured(): boolean {
  return !!(Deno.env.get("WHATSAPP_TOKEN") && Deno.env.get("WHATSAPP_PHONE_NUMBER_ID"));
}

export async function sendWhatsApp(to: string, text: string): Promise<SendResult> {
  const token = Deno.env.get("WHATSAPP_TOKEN");
  const phoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

  if (!token || !phoneId) {
    console.log(`[whatsapp:SIMULATED] -> ${to}: ${text}`);
    return { ok: true, simulated: true };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toIntlPhone(to),
        type: "text",
        text: { body: text },
      }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, simulated: false, error: JSON.stringify(data) };
    return { ok: true, simulated: false, id: data?.messages?.[0]?.id };
  } catch (err) {
    return { ok: false, simulated: false, error: String(err) };
  }
}
