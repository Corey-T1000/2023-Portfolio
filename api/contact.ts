import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Resend } from "resend";

const ALLOWED_ORIGINS = [
  "https://corey-t.com",
  "https://www.corey-t.com",
];

// In development, also allow localhost
if (process.env.VERCEL_ENV !== "production") {
  ALLOWED_ORIGINS.push("http://localhost:4321", "http://localhost:3000");
}

const MIN_SUBMIT_TIME_MS = 2000;
const MAX_MESSAGE_LENGTH = 5000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only POST
  if (req.method === "OPTIONS") {
    return handleCors(req, res);
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Origin check
  const origin = req.headers.origin || req.headers.referer || "";
  const isAllowedOrigin = ALLOWED_ORIGINS.some((allowed) =>
    origin.startsWith(allowed),
  );
  if (!isAllowedOrigin) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Set CORS for valid origin
  res.setHeader("Access-Control-Allow-Origin", origin);

  const { name, email, message, website, _t } = req.body || {};

  // Honeypot — the "website" field is hidden via CSS. Bots fill it in.
  if (website) {
    // Pretend success so bots don't adapt
    return res.status(200).json({ success: true });
  }

  // Timing check — reject if submitted faster than a human could type
  if (_t) {
    const elapsed = Date.now() - Number(_t);
    if (elapsed < MIN_SUBMIT_TIME_MS) {
      return res.status(200).json({ success: true });
    }
  }

  // Validate required fields
  if (!name || !email || !message) {
    return res.status(400).json({ error: "All fields are required" });
  }

  if (typeof email !== "string" || !email.includes("@") || !email.includes(".")) {
    return res.status(400).json({ error: "Invalid email address" });
  }

  if (typeof message === "string" && message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: "Message too long" });
  }

  // Send via Resend
  const resend = new Resend(process.env.RESEND_API_KEY);
  const contactEmail = process.env.CONTACT_EMAIL;

  if (!contactEmail) {
    console.error("CONTACT_EMAIL env var not set");
    return res.status(500).json({ error: "Server configuration error" });
  }

  try {
    const { data, error: sendError } = await resend.emails.send({
      from: "Portfolio Contact <onboarding@resend.dev>",
      to: contactEmail,
      subject: `Portfolio contact from ${name}`,
      replyTo: email,
      text: [
        `Name: ${name}`,
        `Email: ${email}`,
        ``,
        `Message:`,
        message,
      ].join("\n"),
    });

    if (sendError) {
      console.error("Resend API error:", JSON.stringify(sendError));
      return res.status(502).json({ error: "Email delivery failed", detail: sendError.message });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Failed to send email:", error);
    return res.status(500).json({ error: "Failed to send message" });
  }
}

function handleCors(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin || "";
  const isAllowed = ALLOWED_ORIGINS.some((allowed) =>
    origin.startsWith(allowed),
  );

  if (isAllowed) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
  return res.status(204).end();
}
