"use client";

import { useState } from "react";
import Link from "next/link";

export default function PitchPage() {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [segment, setSegment] = useState<"small_contractor" | "large_firm" | "">("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!segment) return;
    setStatus("loading");

    const res = await fetch("/api/pitch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, company, segment }),
    });

    if (res.ok) {
      setStatus("success");
    } else {
      const data = await res.json().catch(() => ({}));
      setErrorMsg(data.error || "Something went wrong. Try again.");
      setStatus("error");
    }
  }

  return (
    <main className="min-h-screen bg-[#0d1a2a] text-white">
      {/* Nav */}
      <nav className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-black tracking-tight">
          PRICE<span className="text-yellow-400">IT</span>
        </Link>
        <Link href="/#waitlist" className="text-sm text-gray-400 hover:text-yellow-400 transition-colors">
          Join waitlist →
        </Link>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-10 text-center">
        <div className="inline-block bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 text-xs font-bold px-3 py-1 rounded-full mb-6 tracking-widest uppercase">
          CEO Pitch Deck
        </div>
        <h1 className="text-4xl md:text-6xl font-black leading-tight mb-4">
          Stop Losing Money<br />
          <span className="text-yellow-400">on Every Bid.</span>
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-10">
          PRICEIT helps contractors price every job in minutes — accurate margins, branded proposals, zero spreadsheets.
          Get the full investor & sales deck sent to your inbox.
        </p>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto mb-14">
          {[
            { num: "63%", label: "of contractors underprice their bids" },
            { num: "6+ hrs", label: "wasted per quote in spreadsheets" },
            { num: "1 in 4", label: "firms lose money on \"profitable\" jobs" },
          ].map((s) => (
            <div key={s.num} className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="text-2xl font-black text-red-400">{s.num}</div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Form + Benefits */}
      <section className="max-w-5xl mx-auto px-6 pb-20 grid md:grid-cols-2 gap-12 items-start">

        {/* Form */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          {status === "success" ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-full bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center text-2xl text-yellow-400 mx-auto mb-4">✓</div>
              <h2 className="text-xl font-black mb-2">Deck on its way!</h2>
              <p className="text-gray-400 text-sm">Check your inbox — we sent the full CEO pitch deck to <span className="text-white">{email}</span>.</p>
              <p className="text-gray-500 text-xs mt-4">Didn&apos;t get it? Check your spam folder.</p>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-black mb-1">Get the Deck</h2>
              <p className="text-gray-500 text-sm mb-6">10-slide CEO pitch deck sent to your inbox instantly.</p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {/* Segment */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: "small_contractor" as const, label: "Small Contractor", sub: "1–10 people" },
                    { id: "large_firm" as const, label: "Large Firm", sub: "10+ employees" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSegment(opt.id)}
                      className={`py-3 px-4 rounded-xl border text-left transition-all ${
                        segment === opt.id
                          ? "bg-yellow-400 border-yellow-400 text-black"
                          : "bg-white/5 border-white/10 text-gray-400 hover:border-yellow-400/40"
                      }`}
                    >
                      <div className="text-sm font-bold">{opt.label}</div>
                      <div className={`text-xs mt-0.5 ${segment === opt.id ? "text-black/60" : "text-gray-600"}`}>{opt.sub}</div>
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  placeholder="Company name"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  required
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm placeholder-gray-600 focus:outline-none focus:border-yellow-400/50 transition-colors"
                />

                <input
                  type="email"
                  placeholder="Work email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm placeholder-gray-600 focus:outline-none focus:border-yellow-400/50 transition-colors"
                />

                {status === "error" && (
                  <p className="text-red-400 text-xs">{errorMsg}</p>
                )}

                <button
                  type="submit"
                  disabled={!segment || status === "loading"}
                  className="bg-yellow-400 hover:bg-yellow-300 text-black font-black py-3 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                >
                  {status === "loading" ? "Sending…" : "Send Me the Deck →"}
                </button>

                <p className="text-gray-600 text-xs text-center">No spam. Unsubscribe anytime.</p>
              </form>
            </>
          )}
        </div>

        {/* Benefits */}
        <div className="flex flex-col gap-6 pt-2">
          <h2 className="text-2xl font-black">What&apos;s inside the deck</h2>

          {[
            { icon: "📊", title: "The market opportunity", body: "$280B construction software market — and why contractors are still pricing in Excel." },
            { icon: "⚡", title: "How PRICEIT works", body: "3-step flow from project scope to branded proposal — ready in minutes, not hours." },
            { icon: "💰", title: "Pricing & tiers", body: "$39 → $149 → $399 → Enterprise. Built for fast adoption and natural upsell." },
            { icon: "🗺️", title: "2026–2027 roadmap", body: "Beta launch → proposal automation → ERP integrations → MENA expansion." },
            { icon: "🎯", title: "Beta access details", body: "How to lock in founding member pricing and get direct access to the team." },
          ].map((item) => (
            <div key={item.title} className="flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center text-lg flex-shrink-0">
                {item.icon}
              </div>
              <div>
                <div className="font-bold text-sm mb-1">{item.title}</div>
                <div className="text-gray-500 text-sm leading-relaxed">{item.body}</div>
              </div>
            </div>
          ))}

          <div className="mt-4 border-t border-white/10 pt-6">
            <p className="text-xs text-gray-600">
              Already convinced?{" "}
              <Link href="/#waitlist" className="text-yellow-400 hover:underline">
                Join the beta waitlist directly →
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-6 text-center">
        <p className="text-gray-600 text-xs">© 2026 PRICEIT · Price smarter. Win more. Build better.</p>
      </footer>
    </main>
  );
}
