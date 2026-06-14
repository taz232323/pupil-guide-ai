type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

type SendEmailResult =
  | { ok: true; id?: string; skipped?: false }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; error: string; status?: number };

function emailFrom() {
  return Deno.env.get("EMAIL_FROM")?.trim() || Deno.env.get("RESEND_FROM")?.trim() || "";
}

export function emailIsConfigured() {
  return Boolean(Deno.env.get("RESEND_API_KEY")?.trim() && emailFrom());
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim();
  const from = emailFrom();

  if (!apiKey || !from) {
    return { ok: true, skipped: true, reason: "Email is not configured." };
  }

  const body: Record<string, unknown> = {
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  };

  if (input.replyTo) body.reply_to = input.replyTo;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error =
      typeof data?.message === "string"
        ? data.message
        : typeof data?.error === "string"
          ? data.error
          : "Email delivery failed.";
    return { ok: false, error, status: response.status };
  }

  return { ok: true, id: typeof data?.id === "string" ? data.id : undefined };
}
