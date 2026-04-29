"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const DEFAULT_PIN = "1234";
const PIN_KEY = "priceit_tools_pin";

const TOOLS = [
  { href: "/generate", label: "Content Engine", icon: "✍️", desc: "Generate marketing content" },
  { href: "/seo", label: "SEO Engine", icon: "🔍", desc: "SEO analysis & optimization" },
  { href: "/repurpose", label: "Repurpose", icon: "♻️", desc: "Repurpose existing content" },
  { href: "/conversion", label: "Conversion Audit", icon: "📈", desc: "Audit landing page conversions" },
  { href: "/history", label: "History", icon: "🕓", desc: "View past generations" },
];

export default function ToolsPage() {
  const [input, setInput] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState(false);
  const [showChangePIN, setShowChangePIN] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinMsg, setPinMsg] = useState("");

  useEffect(() => {
    // Auto-unlock if already verified this session
    if (sessionStorage.getItem("tools_unlocked") === "true") {
      setUnlocked(true);
    }
  }, []);

  function getStoredPin() {
    return localStorage.getItem(PIN_KEY) || DEFAULT_PIN;
  }

  function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (input === getStoredPin()) {
      sessionStorage.setItem("tools_unlocked", "true");
      setUnlocked(true);
      setError(false);
    } else {
      setError(true);
      setInput("");
    }
  }

  function handleLock() {
    sessionStorage.removeItem("tools_unlocked");
    setUnlocked(false);
    setInput("");
  }

  function handleChangePin(e: React.FormEvent) {
    e.preventDefault();
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setPinMsg("PIN must be exactly 4 digits.");
      return;
    }
    if (newPin !== confirmPin) {
      setPinMsg("PINs don't match.");
      return;
    }
    localStorage.setItem(PIN_KEY, newPin);
    setPinMsg("✓ PIN updated successfully.");
    setNewPin("");
    setConfirmPin("");
    setTimeout(() => {
      setShowChangePIN(false);
      setPinMsg("");
    }, 1500);
  }

  if (!unlocked) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center px-6">
        <Link href="/" className="text-xl font-black tracking-tight mb-12">
          PRICE<span className="text-yellow-400">IT</span>
        </Link>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 w-full max-w-sm text-center">
          <div className="w-12 h-12 rounded-xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center text-xl mx-auto mb-4">🔒</div>
          <h1 className="text-xl font-black mb-1">Internal Tools</h1>
          <p className="text-gray-500 text-sm mb-6">Enter your 4-digit PIN to continue</p>
          <form onSubmit={handlePinSubmit} className="flex flex-col gap-3">
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={input}
              onChange={(e) => { setInput(e.target.value.replace(/\D/g, "")); setError(false); }}
              placeholder="• • • •"
              className={`text-center text-2xl tracking-[0.5em] bg-white/5 border rounded-xl px-4 py-3 focus:outline-none transition-colors ${
                error ? "border-red-500/60 text-red-400" : "border-white/10 focus:border-yellow-400/50"
              }`}
              autoFocus
            />
            {error && <p className="text-red-400 text-xs">Incorrect PIN. Try again.</p>}
            <button
              type="submit"
              disabled={input.length !== 4}
              className="bg-yellow-400 text-black font-black py-3 rounded-xl hover:bg-yellow-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Unlock →
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/5">
        <Link href="/" className="text-xl font-black tracking-tight">
          PRICE<span className="text-yellow-400">IT</span>
          <span className="ml-2 text-xs font-normal text-gray-600">/ tools</span>
        </Link>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowChangePIN(!showChangePIN)}
            className="text-sm text-gray-500 hover:text-yellow-400 transition-colors"
          >
            Change PIN
          </button>
          <button
            onClick={handleLock}
            className="text-sm text-gray-500 hover:text-red-400 transition-colors"
          >
            Lock 🔒
          </button>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16">
        {showChangePIN && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-10">
            <h2 className="text-lg font-black mb-4">Change PIN</h2>
            <form onSubmit={handleChangePin} className="flex flex-col gap-3 max-w-xs">
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                placeholder="New 4-digit PIN"
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-yellow-400/50 transition-colors"
              />
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                placeholder="Confirm new PIN"
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-yellow-400/50 transition-colors"
              />
              {pinMsg && (
                <p className={`text-xs ${pinMsg.startsWith("✓") ? "text-green-400" : "text-red-400"}`}>
                  {pinMsg}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="bg-yellow-400 text-black font-bold px-4 py-2 rounded-lg text-sm hover:bg-yellow-300 transition-colors"
                >
                  Save PIN
                </button>
                <button
                  type="button"
                  onClick={() => { setShowChangePIN(false); setPinMsg(""); setNewPin(""); setConfirmPin(""); }}
                  className="text-gray-500 hover:text-white px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <h1 className="text-3xl font-black mb-2">Internal Tools</h1>
        <p className="text-gray-500 text-sm mb-10">Your PRICEIT marketing & content toolkit</p>

        <div className="grid sm:grid-cols-2 gap-4">
          {TOOLS.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="flex items-start gap-4 bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-yellow-400/30 hover:bg-white/8 transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center text-lg flex-shrink-0 group-hover:bg-yellow-400/20 transition-colors">
                {tool.icon}
              </div>
              <div>
                <div className="font-bold text-sm mb-0.5 group-hover:text-yellow-400 transition-colors">{tool.label}</div>
                <div className="text-gray-500 text-xs">{tool.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
