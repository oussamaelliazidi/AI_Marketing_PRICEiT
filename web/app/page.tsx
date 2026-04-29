"use client";

import { useState } from "react";

function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [segment, setSegment] = useState<"small_contractor" | "large_firm" | "">("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error" | "duplicate">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!segment) return;
    setStatus("loading");

    const res = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, segment }),
    });

    const data = await res.json();

    if (res.ok) {
      setStatus("success");
      setEmail("");
      setSegment("");
      setTimeout(() => setStatus("idle"), 4000);
    } else if (res.status === 409) {
      setStatus("duplicate");
      setMessage(data.error);
    } else {
      setStatus("error");
      setMessage(data.error);
    }
  }

  return (
    <div id="waitlist" className="w-full max-w-lg mx-auto">
      {status === "success" ? (
        <div className="flex flex-col items-center gap-3 py-6">
          <div className="w-14 h-14 rounded-full bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center text-2xl text-yellow-400">✓</div>
          <p className="text-xl font-bold text-white">You're on the list!</p>
          <p className="text-sm text-gray-500">We'll reach out when your beta spot is ready.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* Segment selector */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSegment("small_contractor")}
              className={`py-3 px-4 rounded-xl border text-sm font-semibold transition-all ${
                segment === "small_contractor"
                  ? "bg-yellow-400 border-yellow-400 text-black"
                  : "bg-white/5 border-white/10 text-gray-400 hover:border-yellow-400/40"
              }`}
            >
              Small Contractor
            </button>
            <button
              type="button"
              onClick={() => setSegment("large_firm")}
              className={`py-3 px-4 rounded-xl border text-sm font-semibold transition-all ${
                segment === "large_firm"
                  ? "bg-yellow-400 border-yellow-400 text-black"
                  : "bg-white/5 border-white/10 text-gray-400 hover:border-yellow-400/40"
              }`}
            >
              Large Firm
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setStatus("idle"); }}
              placeholder="your@email.com"
              required
              disabled={status === "loading"}
              className="flex-1 px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-yellow-400/60 transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={status === "loading" || !segment}
              className="px-6 py-3.5 bg-yellow-400 text-black font-bold rounded-xl hover:bg-yellow-300 active:scale-95 transition-all whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {status === "loading" ? "Joining..." : "Join the Beta"}
            </button>
          </div>
          {!segment && (
            <p className="text-xs text-gray-600 text-center">Select your profile above to continue</p>
          )}
          {(status === "error" || status === "duplicate") && (
            <p className={`text-sm text-center ${status === "duplicate" ? "text-yellow-400" : "text-red-400"}`}>{message}</p>
          )}
          <p className="text-xs text-gray-600 text-center">Free during beta · No credit card · Cancel anytime</p>
        </form>
      )}
    </div>
  );
}

export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const painPoints = [
    {
      icon: "⏱",
      title: "Stop pricing jobs by gut feel",
      desc: "Manual spreadsheets take hours and still leave money on the table. PRICEIT gives you accurate pricing in 2 minutes — every time.",
      target: "Small Contractors",
    },
    {
      icon: "📉",
      title: "End the under-bid cycle",
      desc: "One bad estimate wipes out a month of profit. PRICEIT's pricing engine accounts for every cost, every trade, every scope change.",
      target: "Small Contractors",
    },
    {
      icon: "⚡",
      title: "Cut estimating time by 60%",
      desc: "Your estimating team spends days on bids that should take hours. PRICEIT slashes turnaround without sacrificing margin accuracy.",
      target: "Large Firms",
    },
    {
      icon: "📋",
      title: "Full audit trail, zero rework",
      desc: "Scope changes kill profitability. PRICEIT tracks every revision so your numbers stay accurate from first bid to final invoice.",
      target: "Large Firms",
    },
  ];

  const steps = [
    { step: "01", title: "Input your job scope", desc: "Enter trade types, materials, and labour. PRICEIT knows the rest." },
    { step: "02", title: "Get instant pricing", desc: "Accurate cost breakdown in under 2 minutes — no spreadsheets, no guesswork." },
    { step: "03", title: "Win more, earn more", desc: "Submit competitive bids with confidence. Track margin on every job." },
  ];

  const faqs = [
    {
      q: "We already use spreadsheets — why switch?",
      a: "Most of our best beta users started there too. PRICEIT imports your existing templates so you keep your pricing logic and just run it 10x faster.",
    },
    {
      q: "We have Procore / Buildertrend — do we need this?",
      a: "PRICEIT integrates with both. It's not a project management replacement — it's the pricing engine that sits on top and handles the estimating layer specifically.",
    },
    {
      q: "What does beta cost?",
      a: "Beta is completely free. We're looking for partners to shape the product. You'd get lifetime early-adopter pricing and direct input on the roadmap.",
    },
    {
      q: "Is it right for a small crew?",
      a: "Especially so. Owner-operators are our fastest-growing segment — PRICEIT is designed to price a $45K job in 8 minutes, no estimating department required.",
    },
    {
      q: "What about data privacy?",
      a: "Your pricing data is yours. We never share it, never train on it without consent, and you can export or delete it at any time.",
    },
  ];

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">

      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/5">
        <span className="text-xl font-black tracking-tight">
          PRICE<span className="text-yellow-400">IT</span>
        </span>
        <div className="flex items-center gap-6">
          <a href="#how-it-works" className="text-sm font-medium text-zinc-500 hover:text-white transition-colors">
            How it works
          </a>
          <a href="#why-priceit" className="text-sm font-medium text-zinc-500 hover:text-white transition-colors">
            Why PRICEIT
          </a>
          <a href="#faq" className="text-sm font-medium text-zinc-500 hover:text-white transition-colors">
            FAQ
          </a>
          <a href="/pitch" className="text-sm font-medium text-yellow-400 hover:text-yellow-300 transition-colors">
            Get the Deck →
          </a>
          <a href="#waitlist" className="text-sm font-bold bg-yellow-400 text-black px-4 py-2 rounded-lg hover:bg-yellow-300 transition-colors">
            Join beta
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-6 text-center pt-24 pb-20">
        <div className="inline-flex items-center gap-2 bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 text-xs font-semibold px-4 py-1.5 rounded-full mb-8 tracking-wide uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
          Beta now open
        </div>
        <h1 className="text-5xl sm:text-7xl font-black tracking-tight leading-none mb-6 max-w-3xl">
          Price every job<br />
          <span className="text-yellow-400">in 2 minutes.</span>
        </h1>
        <p className="text-lg sm:text-xl text-gray-400 max-w-xl mb-12 leading-relaxed">
          Stop losing money on under-bids. PRICEIT gives contractors and
          construction firms accurate, instant pricing — no spreadsheets, no guesswork.
        </p>
        <WaitlistForm />

        <p className="text-gray-600 text-sm mt-4">
          Investor or partner?{" "}
          <a href="/pitch" className="text-yellow-400 hover:underline">
            Get the CEO pitch deck →
          </a>
        </p>

        {/* Stats */}
        <div className="flex items-center gap-6 mt-16 text-sm text-gray-500">
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-white">2 min</span>avg. pricing time
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-white">60%</span>less estimating time
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-white">$0</span>during beta
          </div>
        </div>
      </section>

      {/* Pain Points */}
      <section id="why-priceit" className="px-6 py-20 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <p className="text-yellow-400 text-xs font-bold uppercase tracking-widest text-center mb-3">Why PRICEIT</p>
          <h2 className="text-3xl sm:text-4xl font-black text-center mb-12">Built for the way you actually work</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {painPoints.map((p, i) => (
              <div key={i} className="bg-white/3 border border-white/8 rounded-2xl p-6 hover:border-yellow-400/20 transition-colors">
                <div className="text-3xl mb-4">{p.icon}</div>
                <div className="inline-block text-xs font-semibold text-yellow-400/70 bg-yellow-400/10 px-2 py-0.5 rounded-full mb-3">{p.target}</div>
                <h3 className="text-lg font-bold mb-2">{p.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="px-6 py-20 border-t border-white/5 bg-white/2">
        <div className="max-w-4xl mx-auto">
          <p className="text-yellow-400 text-xs font-bold uppercase tracking-widest text-center mb-3">How it works</p>
          <h2 className="text-3xl sm:text-4xl font-black text-center mb-12">From scope to bid in 3 steps</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {steps.map((s, i) => (
              <div key={i} className="flex flex-col gap-3">
                <span className="text-4xl font-black text-yellow-400/30">{s.step}</span>
                <h3 className="text-lg font-bold">{s.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="px-6 py-20 border-t border-white/5">
        <div className="max-w-2xl mx-auto">
          <p className="text-yellow-400 text-xs font-bold uppercase tracking-widest text-center mb-3">FAQ</p>
          <h2 className="text-3xl sm:text-4xl font-black text-center mb-12">Common questions</h2>
          <div className="flex flex-col gap-2">
            {faqs.map((f, i) => (
              <div key={i} className="border border-white/8 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left font-semibold text-sm hover:bg-white/3 transition-colors"
                >
                  {f.q}
                  <span className={`text-yellow-400 text-lg transition-transform ${openFaq === i ? "rotate-45" : ""}`}>+</span>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-gray-400 leading-relaxed border-t border-white/5">
                    {f.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-24 border-t border-white/5 bg-white/2">
        <div className="max-w-2xl mx-auto flex flex-col items-center text-center gap-6">
          <p className="text-yellow-400 text-xs font-bold uppercase tracking-widest">Limited beta spots</p>
          <h2 className="text-3xl sm:text-5xl font-black leading-tight">
            Ready to price every job<br />
            <span className="text-yellow-400">like a pro?</span>
          </h2>
          <p className="text-gray-400 max-w-md">
            Join contractors and construction firms already on the waitlist. Free during beta, no credit card required.
          </p>
          <WaitlistForm />
        </div>
      </section>

      {/* Footer */}
      <footer className="px-8 py-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-700">
        <span className="font-black text-gray-600">PRICE<span className="text-yellow-400/50">IT</span></span>
        <span>© 2026 PRICEIT · Built for contractors who mean business</span>
      </footer>
    </main>
  );
}
