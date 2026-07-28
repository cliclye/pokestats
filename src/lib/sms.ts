export type SmsResult = {
  ok: boolean;
  skipped?: boolean;
  sid?: string;
  error?: string;
};

export function smsConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER,
  );
}

/** Send an SMS via Twilio REST (no SDK dependency). */
export async function sendSms(to: string, body: string): Promise<SmsResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !from) {
    console.info("[sms] skipped (Twilio env not set)", { to, body });
    return { ok: false, skipped: true, error: "twilio_not_configured" };
  }

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const params = new URLSearchParams({ To: to, From: from, Body: body });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    },
  );

  const json = (await res.json().catch(() => ({}))) as {
    sid?: string;
    message?: string;
    error_message?: string;
  };

  if (!res.ok) {
    return {
      ok: false,
      error: json.message || json.error_message || `HTTP ${res.status}`,
    };
  }

  return { ok: true, sid: json.sid };
}
