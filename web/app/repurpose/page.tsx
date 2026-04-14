"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { VOICES, VoiceType } from "@/lib/voices";

// ── Types & config ─────────────────────────────────────────────────────────

type Segment = "small_contractor" | "large_firm";

const FORMATS = [
  { id: "linkedin_post",    label: "LinkedIn Post" },
  { id: "x_post",           label: "X Post" },
  { id: "instagram",        label: "Instagram" },
  { id: "cold_email",       label: "Cold Email" },
  { id: "email_sequence",   label: "Email Sequence" },
  { id: "blog_intro",       label: "Blog Intro" },
  { id: "facebook_post",    label: "Facebook Post" },
  { id: "whatsapp_message", label: "WhatsApp" },
  { id: "snapchat",         label: "Snapchat" },
];

const SEGMENTS = [
  { id: "small_contractor" as Segment, label: "Small Contractor", sub: "1–20 people" },
  { id: "large_firm"       as Segment, label: "Large Firm",       sub: "50+ employees" },
];

// ── Component ──────────────────────────────────────────────────────────────

export default function RepurposePage() {
  const [sourceContent, setSourceContent] = useState("");
  const [sourceFormat, setSourceFormat]   = useState("linkedin_post");
  const [targetFormat, setTargetFormat]   = useState("cold_email");
  const [segment, setSegment]             = useState<Segment>("small_contractor");
  const [voice, setVoice]                 = useState<VoiceType>("street");
  const [output, setOutput]               = useState("");
  const [isGenerating, setIsGenerating]   = useState(false);
  const [error, setError]                 = useState("");
  const [copied, setCopied]               = useState(false);
  const [qualityScore, setQualityScore]   = useState<number | null>(null);

  const outputRef = useRef<HTMLDivElement>(null);
  const wordCount = output.split(/\s+/).filter(Boolean).length;

  async function repurpose() {
    if (isGenerating || !sourceContent.trim()) return;
    setIsGenerating(true);
    setOutput("");
    setError("");
    setCopied(false);
    setQualityScore(null);

    try {
      const res = await fetch("/api/repurpose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content:      sourceContent.trim(),
          sourceFormat,
          targetFormat,
          segment,
          voice,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Repurpose failed");
      }

      const scoreHeader = res.headers.get("X-Quality-Score");
      if (scoreHeader) setQualityScore(parseInt(scoreHeader, 10));

      const reader  = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setOutput(accumulated);
        if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsGenerating(false);
    }
  }

  function copyToClipboard() {
    if (!output) return;
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function reset() {
    setSourceContent("");
    setOutput("");
    setError("");
    setCopied(false);
    setQualityScore(null);
  }

  const sourceLabel = FORMATS.find((f) => f.id === sourceFormat)?.label ?? sourceFormat;
  const targetLabel = FORMATS.find((f) => f.id === targetFormat)?.label ?? targetFormat;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Nav */}
      <nav className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-yellow-400 font-black text-xl tracking-tight">PRICEIT</span>
          <span className="text-zinc-500 text-sm">/ Repurpose</span>
        </Link>
        <div className="flex items-center gap-4">
          {output && (
            <button
              onClick={reset}
              className="text-xs px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-500 hover:text-red-400 hover:border-red-400/50 transition-all"
            >
              ↺ Reset
            </button>
          )}
          <Link href="/generate"   className="text-zinc-400 text-sm hover:text-white transition-colors">Content Engine →</Link>
          <Link href="/history"    className="text-zinc-400 text-sm hover:text-white transition-colors">History →</Link>
          <Link href="/"           className="text-zinc-400 text-sm hover:text-white transition-colors">← Back</Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-black mb-2">Repurpose Engine</h1>
          <p className="text-zinc-400">
            Take any piece of content and reshape it for a different platform. Same story — different format.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* ── Left: Inputs ── */}
          <div className="space-y-6">

            {/* Source format */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">
                Source Format
              </label>
              <div className="grid grid-cols-3 gap-2">
                {FORMATS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSourceFormat(f.id)}
                    className={`px-3 py-2 rounded-lg border text-xs font-medium text-left transition-all ${
                      sourceFormat === f.id
                        ? "border-yellow-400 bg-yellow-400/10 text-white"
                        : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Source content */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2">
                Paste Your {sourceLabel}
              </label>
              <textarea
                value={sourceContent}
                onChange={(e) => setSourceContent(e.target.value)}
                placeholder={`Paste your ${sourceLabel} here…`}
                rows={8}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-yellow-400 text-sm transition-colors resize-none leading-relaxed"
              />
              {sourceContent && (
                <div className="mt-1 text-xs text-zinc-600 text-right">
                  {sourceContent.split(/\s+/).filter(Boolean).length} words
                </div>
              )}
            </div>

            {/* Target format */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">
                Target Format
              </label>
              <div className="grid grid-cols-3 gap-2">
                {FORMATS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setTargetFormat(f.id)}
                    disabled={f.id === sourceFormat}
                    className={`px-3 py-2 rounded-lg border text-xs font-medium text-left transition-all ${
                      f.id === sourceFormat
                        ? "border-zinc-800 bg-zinc-900 text-zinc-700 cursor-not-allowed"
                        : targetFormat === f.id
                        ? "border-blue-400 bg-blue-400/10 text-white"
                        : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Audience + Voice in one row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">
                  Audience
                </label>
                <div className="space-y-2">
                  {SEGMENTS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSegment(s.id)}
                      className={`w-full p-3 rounded-lg border text-left transition-all ${
                        segment === s.id
                          ? "border-yellow-400 bg-yellow-400/10 text-white"
                          : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500"
                      }`}
                    >
                      <div className="font-semibold text-xs">{s.label}</div>
                      <div className="text-xs mt-0.5 opacity-70">{s.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">
                  Voice
                </label>
                <div className="space-y-2">
                  {VOICES.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setVoice(v.id)}
                      className={`w-full p-3 rounded-lg border text-left transition-all ${
                        voice === v.id
                          ? "border-yellow-400 bg-yellow-400/10 text-white"
                          : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500"
                      }`}
                    >
                      <div className="font-semibold text-xs">{v.label}</div>
                      <div className="text-xs mt-0.5 opacity-60 leading-tight">{v.tagline}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Arrow summary */}
            {sourceContent.trim() && (
              <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-xs text-zinc-400">
                <span className="font-semibold text-white">{sourceLabel}</span>
                <span className="text-yellow-400">→</span>
                <span className="font-semibold text-white">{targetLabel}</span>
                <span className="text-zinc-600">·</span>
                <span className="capitalize">{voice} voice</span>
                <span className="text-zinc-600">·</span>
                <span>{segment === "large_firm" ? "Large Firm" : "Small Contractor"}</span>
              </div>
            )}

            {/* CTA */}
            <button
              onClick={repurpose}
              disabled={isGenerating || !sourceContent.trim()}
              className={`w-full py-4 rounded-lg font-black text-lg tracking-tight transition-all ${
                isGenerating || !sourceContent.trim()
                  ? "bg-yellow-400/50 text-black/50 cursor-not-allowed"
                  : "bg-yellow-400 hover:bg-yellow-300 text-black cursor-pointer"
              }`}
            >
              {isGenerating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Repurposing…
                </span>
              ) : `Repurpose → ${targetLabel}`}
            </button>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}
          </div>

          {/* ── Right: Output ── */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
                {targetLabel} Output
              </label>
              <div className="flex items-center gap-2">
                {qualityScore !== null && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                    qualityScore >= 70
                      ? "bg-green-400/15 text-green-400 border-green-400/30"
                      : qualityScore >= 50
                      ? "bg-yellow-400/15 text-yellow-400 border-yellow-400/30"
                      : "bg-red-400/15 text-red-400 border-red-400/30"
                  }`}>
                    Quality {qualityScore}
                  </span>
                )}
                {output && (
                  <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-all"
                  >
                    {copied ? (
                      <><svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg><span className="text-green-400">Copied!</span></>
                    ) : (
                      <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy</>
                    )}
                  </button>
                )}
              </div>
            </div>

            <div
              ref={outputRef}
              className={`flex-1 min-h-[560px] bg-zinc-900 border rounded-lg p-6 overflow-y-auto transition-colors ${
                error ? "border-red-500/50" : output ? "border-zinc-700" : "border-zinc-800"
              }`}
            >
              {error ? (
                <div className="text-red-400 text-sm">
                  <div className="font-semibold mb-1">Error</div>
                  <div>{error}</div>
                </div>
              ) : output ? (
                <pre className="text-zinc-100 text-sm leading-relaxed whitespace-pre-wrap font-sans">
                  {output}
                  {isGenerating && (
                    <span className="inline-block w-0.5 h-4 bg-yellow-400 ml-0.5 animate-pulse" />
                  )}
                </pre>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-zinc-600">
                  <div className="text-4xl mb-3">🔄</div>
                  <div className="text-sm text-center leading-relaxed">
                    Paste your content, pick source + target format,<br />
                    hit Repurpose. Same story — new platform.
                  </div>
                  {isGenerating && (
                    <div className="mt-4 text-yellow-400 text-xs animate-pulse">
                      Reshaping content…
                    </div>
                  )}
                </div>
              )}
            </div>

            {output && (
              <div className="mt-2 text-xs text-zinc-600 text-right">
                {wordCount} words · {output.length} chars
              </div>
            )}

            {output && !isGenerating && (
              <button
                onClick={repurpose}
                className="mt-2 w-full py-2.5 border border-zinc-700 hover:border-zinc-500 rounded-lg text-zinc-400 hover:text-white text-sm transition-all"
              >
                Repurpose again ↻
              </button>
            )}
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-zinc-800 text-center text-zinc-600 text-xs">
          Repurposed content preserves the original story and numbers. Always review before publishing.
        </div>
      </div>
    </div>
  );
}
