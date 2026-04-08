import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
  }

  const { error } = await supabase
    .from("waitlist")
    .insert({ email: email.toLowerCase().trim() });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "You're already on the list!" }, { status: 409 });
    }
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }

  const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "PRICEIT Beta", email: "freecsgon378@gmail.com" },
      to: [{ email }],
      subject: "You're on the PRICEIT beta list 🔨",
      htmlContent: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0a0a0a;color:#ffffff;padding:40px 32px;border-radius:12px;">
          <h1 style="font-size:28px;font-weight:900;margin:0 0 8px;">PRICE<span style="color:#facc15;">IT</span></h1>
          <hr style="border:none;border-top:1px solid #222;margin:20px 0;" />
          <h2 style="font-size:22px;font-weight:800;margin:0 0 12px;">You're on the list.</h2>
          <p style="color:#9ca3af;font-size:15px;line-height:1.6;margin:0 0 24px;">
            Thanks for joining the PRICEIT beta waitlist. We're building the fastest way
            to price construction jobs — no spreadsheets, no guesswork.
          </p>
          <p style="color:#9ca3af;font-size:15px;line-height:1.6;margin:0 0 24px;">
            When your spot opens up, you'll be the first to know. Beta is
            <strong style="color:#ffffff;">completely free</strong> and we'd love your feedback to shape the product.
          </p>
          <div style="background:#111;border:1px solid #222;border-radius:8px;padding:16px 20px;margin:0 0 24px;">
            <p style="margin:0;font-size:13px;color:#6b7280;">Signed up as</p>
            <p style="margin:4px 0 0;font-size:15px;font-weight:600;color:#facc15;">${email}</p>
          </div>
          <p style="color:#4b5563;font-size:13px;margin:0;">
            Built for contractors who mean business · © 2026 PRICEIT
          </p>
        </div>
      `,
    }),
  });

  return NextResponse.json({ success: true }, { status: 200 });
}
