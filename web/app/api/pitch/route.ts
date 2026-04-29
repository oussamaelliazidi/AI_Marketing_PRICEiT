import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { email, company, segment } = body;

  // Validate
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
  }
  if (!company || typeof company !== "string" || company.trim().length < 1) {
    return NextResponse.json({ error: "Company name is required." }, { status: 400 });
  }
  if (!["small_contractor", "large_firm"].includes(segment)) {
    return NextResponse.json({ error: "Please select a segment." }, { status: 400 });
  }

  const rawEmail = email.toLowerCase().trim();
  const safeEmail = escapeHtml(rawEmail);
  const safeCompany = escapeHtml(company.trim().slice(0, 120));
  const segmentLabel = segment === "small_contractor" ? "Small Contractor" : "Large Firm";

  // Log to Supabase (reuse waitlist table, add pitch_request flag)
  try {
    await getSupabase()
      .from("waitlist")
      .upsert(
        { email: rawEmail, segment, source: "pitch_page" },
        { onConflict: "email", ignoreDuplicates: false }
      );
  } catch (_) {
    // Non-fatal — still send the email
  }

  // Send deck via Brevo
  const deckUrl = "https://drive.google.com/file/d/1TFvd-QZg3qGEP1bwv1wKzVnGtNccFYDg/view?usp=sharing";

  const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "PRICEIT", email: "freecsgon378@gmail.com" },
      to: [{ email: rawEmail, name: safeCompany }],
      subject: "Your PRICEIT CEO Pitch Deck 🏗️",
      htmlContent: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#0d1a2a;color:#ffffff;padding:40px 32px;border-radius:12px;">
          <h1 style="font-size:28px;font-weight:900;margin:0 0 8px;">
            PRICE<span style="color:#F5C518;">IT</span>
          </h1>
          <hr style="border:none;border-top:1px solid #1e3553;margin:20px 0;" />

          <h2 style="font-size:22px;font-weight:800;margin:0 0 12px;">Here&apos;s your deck, ${safeCompany}.</h2>
          <p style="color:#8fa3bc;font-size:15px;line-height:1.6;margin:0 0 24px;">
            Thanks for your interest in PRICEIT. The full CEO pitch deck is ready for you — 10 slides covering the problem, solution, market size, pricing, and roadmap.
          </p>

          <a href="${deckUrl}"
            style="display:block;background:#F5C518;color:#0d1a2a;font-weight:900;font-size:16px;text-align:center;padding:14px 24px;border-radius:10px;text-decoration:none;margin-bottom:28px;">
            View the Deck →
          </a>

          <div style="background:#1a2e4a;border:1px solid #1e3553;border-radius:10px;padding:20px 24px;margin-bottom:28px;">
            <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#F5C518;text-transform:uppercase;letter-spacing:0.05em;">What&apos;s inside</p>
            <ul style="margin:0;padding-left:18px;color:#8fa3bc;font-size:14px;line-height:2;">
              <li>The $280B market opportunity</li>
              <li>How PRICEIT works — 3 steps</li>
              <li>Pricing tiers: $39 / $149 / $399 / Enterprise</li>
              <li>2026–2027 roadmap</li>
              <li>Beta access &amp; founding member pricing</li>
            </ul>
          </div>

          <div style="background:#1a2e4a;border-left:3px solid #F5C518;border-radius:0 8px 8px 0;padding:14px 18px;margin-bottom:28px;">
            <p style="margin:0;font-size:14px;color:#ffffff;font-weight:700;">Founding member offer</p>
            <p style="margin:6px 0 0;font-size:13px;color:#8fa3bc;">
              Join the beta and lock in <strong style="color:#F5C518;">$39/mo forever</strong> — price never increases as we grow.
              Limited spots available.
            </p>
          </div>

          <p style="color:#4a5c70;font-size:13px;margin:0;">
            Sent to ${escapeHtml(safeEmail)} · ${segmentLabel}<br/>
            © 2026 PRICEIT · Price smarter. Win more. Build better.
          </p>
        </div>
      `,
    }),
  });

  if (!brevoRes.ok) {
    const errText = await brevoRes.text().catch(() => "");
    console.error("[pitch] Brevo error", brevoRes.status, errText);
    return NextResponse.json({ error: "Failed to send email. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
