// =====================================================================
// SalonOS – send an outbound WhatsApp message (manual staff reply or an
// automated appointment confirmation). JWT-protected: only authenticated
// staff (the admin dashboard) may call it. Uses the shared sender, which
// runs in simulation mode until WhatsApp secrets are configured.
//
// POST body: { client_id: uuid, text: string, intent?: string }
// =====================================================================
import { corsHeaders, json } from "../_shared/cors.ts";
import { adminClient } from "../_shared/supabase.ts";
import { sendWhatsApp } from "../_shared/whatsapp.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { client_id, text, intent } = await req.json();
    if (!client_id || !text || !String(text).trim()) {
      return json({ error: "client_id and text are required" }, 400);
    }

    const supabase = adminClient();

    const { data: client, error: ce } = await supabase
      .from("clients").select("id, full_name, phone").eq("id", client_id).single();
    if (ce || !client) return json({ error: "client not found" }, 404);
    if (!client.phone) return json({ error: "client has no phone" }, 400);

    // find or create the WhatsApp conversation
    let { data: conversation } = await supabase
      .from("conversations")
      .select("id")
      .eq("client_id", client_id)
      .eq("channel", "whatsapp")
      .maybeSingle();
    if (!conversation) {
      const { data: created, error } = await supabase
        .from("conversations")
        .insert({ client_id, channel: "whatsapp", external_id: client.phone })
        .select("id").single();
      if (error) throw error;
      conversation = created;
    }

    const result = await sendWhatsApp(client.phone, text);

    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      direction: "outbound",
      body: text,
      intent: intent ?? null,
      sent_by_bot: false,
    });
    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversation.id);

    return json({ ok: result.ok, simulated: result.simulated, conversation_id: conversation.id, error: result.error });
  } catch (err) {
    console.error("send-message error:", err);
    return json({ error: String(err) }, 500);
  }
});
