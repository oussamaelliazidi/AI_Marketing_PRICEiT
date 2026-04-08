"use client";

import { useState } from "react";

export default function Home() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error" | "duplicate">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");

    const res = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();

    if (res.ok) {
      setStatus("success");
      setEmail("");
      setTimeout(() => setStatus("idle"), 3000);
    } else if (res.status === 409) {
      setStatus("duplicate");
      setMessage(data.error);
    } else {
      setStatus("error");
      setMessage(data.error);
    }
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5">
        <span className="text-xl font-black tracking-tight">
          PRICE<span className="text-yellow-400">IT</span>
        </span>
        <a
          href="#waitlist"
          className="text-sm font-medium text-gray-400 hover:text-white transition-colors"
        >
          Join beta →
        </a>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 text-center py-24">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 text-xs font-semibold px-4 py-1.5 rounded-full mb-8 tracking-wide uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
          Beta now open
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-7xl font-black tracking-tight leading-none mb-6 max-w-3xl">
          Price every job
          <br />
          <span className="text-yellow-400">in 2 minutes.</span>
        </h1>

        {/* Subhead */}
        <p className="text-lg sm:text-xl text-gray-400 max-w-xl mb-10 leading-relaxed">
          Stop losing money on under-bids. PRICEIT gives contractors and
          construction firms accurate, instant pricing — no spreadsheets, no
          guesswork.
        </p>

        {/* Form */}
        {status === "success" ? (
          <div className="flex flex-col items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center text-2xl">
              ✓
            </div>
            <p className="text-lg font-semibold text-white">You're on the list!</p>
            <p className="text-sm text-gray-500">We'll reach out when your beta spot is ready.</p>
          </div>
        ) : (
          <form
            id="waitlist"
            onSubmit={handleSubmit}
            className="flex flex-col sm:flex-row gap-3 w-full max-w-md mb-4"
          >
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setStatus("idle"); }}
              placeholder="your@email.com"
              required
              disabled={status === "loading"}
              className="flex-1 px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-yellow-400/60 focus:bg-white/8 transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="px-6 py-3.5 bg-yellow-400 text-black font-bold rounded-xl hover:bg-yellow-300 active:scale-95 transition-all whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {status === "loading" ? "Joining..." : "Join the Beta"}
            </button>
          </form>
        )}

        {/* Inline feedback */}
        {(status === "error" || status === "duplicate") && (
          <p className={`text-sm mb-4 ${status === "duplicate" ? "text-yellow-400" : "text-red-400"}`}>
            {message}
          </p>
        )}

        {status !== "success" && (
          <p className="text-xs text-gray-600">
            Free during beta &nbsp;·&nbsp; No credit card &nbsp;·&nbsp; Cancel anytime
          </p>
        )}

        {/* Social proof */}
        <div className="flex items-center gap-6 mt-14 text-sm text-gray-500">
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-white">2 min</span>
            avg. pricing time
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-white">60%</span>
            less estimating time
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-white">$0</span>
            during beta
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-8 py-5 text-center text-xs text-gray-700">
        © 2026 PRICEIT · Built for contractors who mean business
      </footer>
    </main>
  );
}
