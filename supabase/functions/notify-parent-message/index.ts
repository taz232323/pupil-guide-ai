import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendEmail } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ParentMessageRow = {
  id: string;
  class_id: string;
  sender_id: string;
  recipient_id: string | null;
  body: string;
  sender_role: string;
  created_at: string;
};

type ClassRow = {
  id: string;
  name: string;
  subject: string | null;
  teacher_id: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    if (char === '"') return "&quot;";
    return "&#39;";
  });
}

function plainText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ error: "Supabase function is not configured." }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: userData, error: userError } = await userClient.auth.getUser();
    const user = userData?.user;
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const messageId = typeof body.messageId === "string" ? body.messageId : "";
    if (!messageId) return json({ error: "messageId is required." }, 400);

    const { data: message, error: messageError } = await admin
      .from("messages")
      .select("id, class_id, sender_id, recipient_id, body, sender_role, created_at")
      .eq("id", messageId)
      .maybeSingle<ParentMessageRow>();

    if (messageError) return json({ error: messageError.message }, 500);
    if (!message) return json({ error: "Message not found." }, 404);
    if (message.sender_id !== user.id || message.sender_role !== "parent") {
      return json({ error: "Not allowed to notify for this message." }, 403);
    }
    if (!message.recipient_id) return json({ error: "Message has no teacher recipient." }, 400);

    const [{ data: membership }, { data: classRow, error: classError }] = await Promise.all([
      admin
        .from("class_members")
        .select("id")
        .eq("class_id", message.class_id)
        .eq("student_id", user.id)
        .maybeSingle(),
      admin
        .from("classes")
        .select("id, name, subject, teacher_id")
        .eq("id", message.class_id)
        .maybeSingle<ClassRow>(),
    ]);

    if (classError) return json({ error: classError.message }, 500);
    if (!membership || !classRow || classRow.teacher_id !== message.recipient_id) {
      return json({ error: "Message recipient is not this class teacher." }, 403);
    }

    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", [message.sender_id, message.recipient_id]);

    const profileRows = (profiles ?? []) as ProfileRow[];
    const profileMap = new Map(profileRows.map((profile) => [profile.id, profile.full_name]));
    const studentName = profileMap.get(message.sender_id)?.trim() || user.email?.split("@")[0] || "Student";
    const teacherName = profileMap.get(message.recipient_id)?.trim() || "Teacher";

    const { data: teacherAuth, error: teacherAuthError } = await admin.auth.admin.getUserById(message.recipient_id);
    if (teacherAuthError) return json({ error: teacherAuthError.message }, 500);

    const teacherEmail = teacherAuth?.user?.email;
    if (!teacherEmail) {
      return json({ ok: true, skipped: true, reason: "Teacher account has no email address." });
    }

    const appUrl = (Deno.env.get("APP_URL") ?? "").replace(/\/+$/, "");
    const messagesUrl = appUrl ? `${appUrl}/messages` : "";
    const excerpt = plainText(message.body).slice(0, 800);
    const classLabel = classRow.subject ? `${classRow.name} (${classRow.subject})` : classRow.name;
    const subject = `New parent message about ${studentName}`;
    const text = [
      `Hi ${teacherName},`,
      "",
      `A parent/guardian viewing ${studentName}'s account sent you a message for ${classLabel}.`,
      "",
      excerpt ? `"${excerpt}"` : "",
      "",
      messagesUrl ? `Open Grapheion Messages: ${messagesUrl}` : "Open Grapheion to reply from Messages.",
    ].filter(Boolean).join("\n");

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#111827;max-width:620px">
        <p>Hi ${escapeHtml(teacherName)},</p>
        <p>A parent/guardian viewing <strong>${escapeHtml(studentName)}</strong>'s account sent you a message for <strong>${escapeHtml(classLabel)}</strong>.</p>
        ${excerpt ? `<blockquote style="border-left:4px solid #334155;margin:18px 0;padding:8px 0 8px 14px;color:#334155">${escapeHtml(excerpt)}</blockquote>` : ""}
        ${messagesUrl ? `<p><a href="${escapeHtml(messagesUrl)}" style="display:inline-block;background:#334155;color:white;text-decoration:none;padding:10px 14px;border-radius:8px">Open Grapheion Messages</a></p>` : "<p>Open Grapheion to reply from Messages.</p>"}
        <p style="font-size:12px;color:#64748b">This notification was sent because a parent message was created in Grapheion.</p>
      </div>
    `;

    const result = await sendEmail({ to: teacherEmail, subject, html, text });
    if (!result.ok) return json({ error: result.error, status: result.status }, 502);

    return json({
      ok: true,
      emailId: result.id,
      skipped: result.skipped ?? false,
      reason: result.skipped ? result.reason : undefined,
    });
  } catch (error) {
    console.error("notify-parent-message fatal:", error);
    return json({ error: (error as Error).message }, 500);
  }
});
