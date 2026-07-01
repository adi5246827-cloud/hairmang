// =====================================================================
// SalonOS AI – WhatsApp webhook (spec §5)
//   GET  : Meta webhook verification handshake
//   POST : ingest inbound messages -> client + conversation + message,
//          detect intent, queue an outbound reply.
// Set secrets:  WHATSAPP_VERIFY_TOKEN  (and SUPABASE_* are auto-injected)
// =====================================================================
import { corsHeaders, json } from "../_shared/cors.ts";
import { adminClient } from "../_shared/supabase.ts";
import { sendWhatsApp } from "../_shared/whatsapp.ts";
import { aiReply } from "../_shared/ai.ts";

type Intent =
  | "book_appointment"
  | "cancel_appointment"
  | "reschedule"
  | "price_inquiry"
  | "product_recommendation"
  | "general";

/** Very small Hebrew/English keyword intent classifier (replace with LLM later). */
function detectIntent(text: string): Intent {
  const t = text.toLowerCase();
  if (/(בטל|ביטול|cancel)/.test(t)) return "cancel_appointment";
  if (/(שנה|לשנות|אחר|reschedule|change)/.test(t)) return "reschedule";
  if (/(מחיר|כמה עולה|מחירון|price|cost)/.test(t)) return "price_inquiry";
  if (/(מוצר|שמפו|מסכה|product|shampoo)/.test(t)) return "product_recommendation";
  if (/(תור|לקבוע|צבע|תספורת|פן|החלקה|book|appointment)/.test(t)) {
    return "book_appointment";
  }
  return "general";
}

function replyFor(intent: Intent): string {
  switch (intent) {
    case "book_appointment":
      return "נשמח לקבוע לך תור! איזה שירות תרצי ומתי נוח לך? יש ספר/ית מועדף/ת?";
    case "cancel_appointment":
      return "אין בעיה לבטל. מה השם והשעה של התור? נשמור לך מקום ברשימת המתנה אם תרצי.";
    case "reschedule":
      return "בשמחה נשנה את התור. לאיזה יום ושעה להעביר?";
    case "price_inquiry":
      return "שולחים מחירון מעודכן 💇 על איזה שירות תרצי לדעת?";
    case "product_recommendation":
      return "לפי הטיפול האחרון שלך נמליץ על המוצר המתאים לשמירה על התוצאה ✨";
    default:
      return "היי! איך אפשר לעזור? אפשר לקבוע תור, לבדוק מחירים או לקבל המלצות.";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // --- Meta verification handshake ---
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const verifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN");
    if (mode === "subscribe" && token && token === verifyToken) {
      return new Response(challenge ?? "", { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const payload = await req.json();
    const supabase = adminClient();

    // Normalise: accept either a raw {from,text} test payload or the
    // WhatsApp Cloud API envelope.
    const cloud = payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const from: string | undefined = cloud?.from ?? payload?.from;
    const text: string | undefined = cloud?.text?.body ?? payload?.text;

    if (!from || !text) {
      return json({ status: "ignored", reason: "no message" }, 200);
    }

    // 1. find or create the client by phone
    let { data: client } = await supabase
      .from("clients")
      .select("id, full_name")
      .eq("phone", from)
      .maybeSingle();

    if (!client) {
      const { data: created, error } = await supabase
        .from("clients")
        .insert({ full_name: `WhatsApp ${from}`, phone: from })
        .select("id, full_name")
        .single();
      if (error) throw error;
      client = created;
    }

    // 2. find or create an open WhatsApp conversation
    let { data: conversation } = await supabase
      .from("conversations")
      .select("id, is_bot_active")
      .eq("client_id", client.id)
      .eq("channel", "whatsapp")
      .maybeSingle();

    if (!conversation) {
      const { data: created, error } = await supabase
        .from("conversations")
        .insert({ client_id: client.id, channel: "whatsapp", external_id: from })
        .select("id")
        .single();
      if (error) throw error;
      conversation = created;
    }

    const intent = detectIntent(text);

    // 3. store inbound message
    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      direction: "inbound",
      body: text,
      intent,
      sent_by_bot: false,
    });

    // 4. reply — only when the bot is active for this conversation (a human
    //    can take over by flipping conversations.is_bot_active to false).
    let reply: string | null = null;
    let sent: { simulated: boolean; ok: boolean } | null = null;
    if (conversation.is_bot_active !== false) {
      // prefer an AI reply (if ANTHROPIC_API_KEY is set); else keyword reply
      reply = (await aiReply(text, { clientName: client.full_name })) ?? replyFor(intent);

      // actually send it (real Cloud API or simulation)
      sent = await sendWhatsApp(from, reply);

      await supabase.from("messages").insert({
        conversation_id: conversation.id,
        direction: "outbound",
        body: reply,
        intent,
        sent_by_bot: true,
      });
    }

    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversation.id);

    return json({ status: "ok", intent, reply, simulated: sent?.simulated ?? null, client_id: client.id });
  } catch (err) {
    console.error("whatsapp-webhook error:", err);
    return json({ error: String(err) }, 500);
  }
});
