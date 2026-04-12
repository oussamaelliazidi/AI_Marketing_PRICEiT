"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { VOICES, VoiceType } from "@/lib/voices";

// ── Types ──────────────────────────────────────────────────────────────────

type Segment = "small_contractor" | "large_firm";

interface SeoChecks {
  keywordInH1: boolean;
  keywordInMetaTitle: boolean;
  metaDescriptionPresent: boolean;
  wordCount: number;
  wordCountOk: boolean;
  faqPresent: boolean;
  ctaPresent: boolean;
}

// ── Config ─────────────────────────────────────────────────────────────────

const KEYWORD_SUGGESTIONS: Record<Segment, string[]> = {
  small_contractor: [
    "how to estimate a roofing job",
    "construction job pricing app",
    "how to price a plumbing job",
    "contractor estimating software free",
    "how to win more construction bids",
    "construction quote template",
    "how to price labour and materials",
    "small contractor bidding tips",
    "how to avoid under-bidding jobs",
    "fastest way to quote a construction job",
  ],
  large_firm: [
    "construction estimating software for large firms",
    "how to reduce estimating time",
    "construction bid management software",
    "estimating department bottleneck",
    "how to improve construction bid accuracy",
    "construction project pricing tools",
    "automated construction estimating",
    "commercial construction bidding process",
    "how to scale a construction estimating team",
    "construction margin management",
  ],
};

const SEGMENTS = [
  { id: "small_contractor" as Segment, label: "Small Contractor", sub: "1–20 people" },
  { id: "large_firm" as Segment, label: "Large Firm", sub: "50+ employees" },
];

// ── Component ──────────────────────────────────────────────────────────────

export default function SeoPage() {
  const [keyword, setKeyword]   = useState("");
  const [segment, setSegment]   = useState<Segment>("small_contractor");
  const [voice, setVoice]       = useState<VoiceType>("professional");
  const [output, setOutput]     = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError]       = useState("");
  const [copied, setCopied]     = useState(false);
  const [seoScore, setSeoScore] = useState<number | null>(null);
  const [seoChecks, setSeoChecks] = useState<SeoChecks | null>(null);

  const outputRef = useRef<HTMLDivElement>(null);
  const wordCount = output.split(/\s+/).filter(Boolean).length;

  async function generate() {
    if (isGenerating || !keyword.trim()) return;
    setIsGenerating(true);
    setOutput("");
    setError("");
    setCopied(false);
    setSeoScore(null);
    setSeoChecks(null);

    try {
      const res = await fetch("/api/seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: keyword.trim(), segment, voice }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Generation failed");
      }

      const scoreHeader  = res.headers.get("X-SEO-Score");
      const checksHeader = res.headers.get("X-SEO-Checks");
      if (scoreHeader)  setSeoScore(parseInt(scoreHeader, 10));
      if (checksHeader) setSeoChecks(JSON.parse(checksHeader));

      const reader = res.body!.getReader();
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
    setOutput("");
    setError("");
    setCopied(false);
    setSeoScore(null);
    setSeoChecks(null);
    setKeyword("");
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Nav */}
      <nav className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-yellow-400 font-black text-xl tracking-tight">PRICEIT</span>
          <span className="text-zinc-500 text-sm">/ SEO Engine</span>
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
          <Link href="/generate" className="text-zinc-400 text-sm hover:text-white transition-colors">
            Content Engine →
          </Link>
          <Link href="/" className="text-zinc-400 text-sm hover:text-white transition-colors">
            ← Back to site
          </Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-black mb-2">SEO Engine</h1>
          <p className="text-zinc-400">
            Turn a keyword into a Google-ready blog post. Full structure, meta tags, FAQ — in PRICEIT voice.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* ── Left: Controls ── */}
          <div className="space-y-6">

            {/* Keyword input */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">
                Target Keyword
              </label>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && generate()}
                placeholder="e.g. how to estimate a roofing job"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-yellow-400 text-sm transition-colors"
              />
              {/* Keyword suggestions */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {KEYWORD_SUGGESTIONS[segment].map((s) => (
                  <button
                    key={s}
                    onClick={() => setKeyword(s)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                      keyword === s
                        ? "border-yellow-400/60 bg-yellow-400/10 text-yellow-400"
                        : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500 hover:text-white"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Audience */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">
                Target Audience
              </label>
              <div className="grid grid-cols-2 gap-3">
                {SEGMENTS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSegment(s.id)}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      segment === s.id
                        ? "border-yellow-400 bg-yellow-400/10 text-white"
                        : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500"
                    }`}
                  >
                    <div className="font-semibold text-sm">{s.label}</div>
                    <div className="text-xs mt-0.5 opacity-70">{s.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Voice */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">
                Voice
              </label>
              <div className="grid grid-cols-3 gap-2">
                {VOICES.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setVoice(v.id)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      voice === v.id
                        ? "border-yellow-400 bg-yellow-400/10 text-white"
                        : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500"
                    }`}
                  >
                    <div className="font-semibold text-sm">{v.label}</div>
                    <div className="text-xs mt-0.5 opacity-60 leading-tight">{v.tagline}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Generate */}
            <button
              onClick={generate}
              disabled={isGenerating || !keyword.trim()}
              className={`w-full py-4 rounded-lg font-black text-lg tracking-tight transition-all ${
                isGenerating || !keyword.trim()
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
                  Writing post…
                </span>
              ) : "Generate SEO Post"}
            </button>

            {/* SEO checks panel */}
            {seoChecks && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
                    SEO Checks
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    seoScore! >= 75
                      ? "bg-green-400/15 text-green-400 border border-green-400/30"
                      : seoScore! >= 55
                      ? "bg-yellow-400/15 text-yellow-400 border border-yellow-400/30"
                      : "bg-red-400/15 text-red-400 border border-red-400/30"
                  }`}>
                    SEO {seoScore}/100
                  </span>
                </div>
                <div className="space-y-2">
                  {[
                    { label: "Keyword in H1",        ok: seoChecks.keywordInH1 },
                    { label: "Keyword in meta title", ok: seoChecks.keywordInMetaTitle },
                    { label: "Meta description",      ok: seoChecks.metaDescriptionPresent },
                    { label: `${seoChecks.wordCount} words (600+ target)`, ok: seoChecks.wordCountOk },
                    { label: "FAQ section",           ok: seoChecks.faqPresent },
                    { label: "CTA / beta mention",    ok: seoChecks.ctaPresent },
                  ].map((check) => (
                    <div key={check.label} className="flex items-center gap-2 text-xs">
                      <span className={check.ok ? "text-green-400" : "text-red-400"}>
                        {check.ok ? "✓" : "✗"}
                      </span>
                      <span className={check.ok ? "text-zinc-300" : "text-zinc-500"}>
                        {check.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Right: Output ── */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
                Output
              </label>
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

            <div
              ref={outputRef}
              className={`flex-1 min-h-[600px] bg-zinc-900 border rounded-lg p-6 overflow-y-auto transition-colors ${
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
                  <div className="text-4xl mb-3">🔍</div>
                  <div className="text-sm text-center">
                    Enter a keyword and hit Generate.<br />
                    Full blog post with meta tags + FAQ.
                  </div>
                  {isGenerating && (
                    <div className="mt-4 text-yellow-400 text-xs animate-pulse">
                      Writing your post…
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
                onClick={generate}
                className="mt-2 w-full py-2.5 border border-zinc-700 hover:border-zinc-500 rounded-lg text-zinc-400 hover:text-white text-sm transition-all"
              >
                Regenerate ↻
              </button>
            )}
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-zinc-800 text-center text-zinc-600 text-xs">
          SEO content generated for PRICEIT. Always review before publishing — add internal links and images manually.
        </div>
      </div>
    </div>
  );
}
