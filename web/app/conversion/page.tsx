"use client";

import { useState } from "react";
import Link from "next/link";
import type {
  ConversionAuditResult,
  BenchmarkScores,
  PainPointCluster,
  Recommendation,
} from "@/app/api/conversion-audit/route";

// ── Types ──────────────────────────────────────────────────────────────────

type Segment = "small_contractor" | "large_firm";

// ── Helpers ────────────────────────────────────────────────────────────────

const BENCHMARK_LABELS: Record<keyof BenchmarkScores, string> = {
  headline_clarity: "Headline Clarity",
  value_prop:       "Value Proposition",
  social_proof:     "Social Proof",
  cta_strength:     "CTA Strength",
  pain_points:      "Pain Points",
  urgency:          "Urgency",
};

function scoreColor(score: number, max = 10) {
  const pct = (score / max) * 100;
  if (pct >= 70) return "text-green-400";
  if (pct >= 45) return "text-yellow-400";
  return "text-red-400";
}

function scoreBg(score: number, max = 10) {
  const pct = (score / max) * 100;
  if (pct >= 70) return "bg-green-400";
  if (pct >= 45) return "bg-yellow-400";
  return "bg-red-400";
}

function overallGrade(score: number) {
  if (score >= 80) return { label: "Strong", color: "text-green-400", ring: "border-green-400/40" };
  if (score >= 60) return { label: "Average", color: "text-yellow-400", ring: "border-yellow-400/40" };
  return { label: "Weak", color: "text-red-400", ring: "border-red-400/40" };
}

const SEGMENTS = [
  { id: "small_contractor" as Segment, label: "Small Contractor", sub: "1–20 people" },
  { id: "large_firm" as Segment, label: "Large Firm", sub: "50+ employees" },
];

// ── Component ──────────────────────────────────────────────────────────────

export default function ConversionPage() {
  const [headline, setHeadline]       = useState("");
  const [pageContent, setPageContent] = useState("");
  const [pageUrl, setPageUrl]         = useState("");
  const [segment, setSegment]         = useState<Segment>("small_contractor");
  const [isAuditing, setIsAuditing]   = useState(false);
  const [error, setError]             = useState("");
  const [result, setResult]           = useState<ConversionAuditResult | null>(null);
  const [copiedIdx, setCopiedIdx]     = useState<number | null>(null);
  const [variantScores, setVariantScores] = useState<Record<number, number>>({});
  const [originalHeadlineScore, setOriginalHeadlineScore] = useState<number | null>(null);
  const [testingIdx, setTestingIdx]   = useState<number | null>(null);

  async function scoreHeadline(text: string): Promise<number | null> {
    try {
      const res = await fetch("/api/headline-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headline: text, segment }),
      });
      const data = await res.json();
      return res.ok && typeof data.score === "number" ? data.score : null;
    } catch {
      return null;
    }
  }

  async function testVariant(variant: string, idx: number) {
    if (testingIdx !== null) return;
    setTestingIdx(idx);

    // Score original headline on first test (for fair headline-only comparison)
    if (originalHeadlineScore === null) {
      const origScore = await scoreHeadline(headline);
      if (origScore !== null) setOriginalHeadlineScore(origScore);
    }

    const score = await scoreHeadline(variant);
    if (score !== null) {
      setVariantScores((prev) => ({ ...prev, [idx]: score }));
    }
    setTestingIdx(null);
  }

  async function runAudit() {
    if (isAuditing || !headline.trim()) return;
    setIsAuditing(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/conversion-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headline:    headline.trim(),
          pageContent: pageContent.trim() || undefined,
          pageUrl:     pageUrl.trim()    || undefined,
          segment,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Audit failed");
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsAuditing(false);
    }
  }

  function copyVariant(text: string, idx: number) {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }

  function reset() {
    setHeadline("");
    setPageContent("");
    setPageUrl("");
    setError("");
    setResult(null);
    setVariantScores({});
    setOriginalHeadlineScore(null);
  }

  const grade = result ? overallGrade(result.overall_score) : null;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Nav */}
      <nav className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-yellow-400 font-black text-xl tracking-tight">PRICEIT</span>
          <span className="text-zinc-500 text-sm">/ Conversion Audit</span>
        </Link>
        <div className="flex items-center gap-4">
          {result && (
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
          <Link href="/seo" className="text-zinc-400 text-sm hover:text-white transition-colors">
            SEO Engine →
          </Link>
          <Link href="/" className="text-zinc-400 text-sm hover:text-white transition-colors">
            ← Back
          </Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-black mb-2">Conversion Audit</h1>
          <p className="text-zinc-400">
            Paste your headline and page copy. Get an instant CRO score, recommendations, and headline variants.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* ── Left: Inputs ── */}
          <div className="space-y-6">

            {/* Segment */}
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

            {/* Page URL (optional) */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2">
                Page URL <span className="normal-case font-normal text-zinc-600">(optional — for tracking)</span>
              </label>
              <input
                type="text"
                value={pageUrl}
                onChange={(e) => setPageUrl(e.target.value)}
                placeholder="e.g. https://priceit.io"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-yellow-400 text-sm transition-colors"
              />
            </div>

            {/* Headline */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2">
                Current Headline <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runAudit()}
                placeholder="e.g. Price every job in under 2 minutes"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-yellow-400 text-sm transition-colors"
              />
            </div>

            {/* Page content */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2">
                Page Body Copy <span className="normal-case font-normal text-zinc-600">(optional — paste for deeper audit)</span>
              </label>
              <textarea
                value={pageContent}
                onChange={(e) => setPageContent(e.target.value)}
                placeholder="Paste your landing page text here — hero section, features, testimonials, CTA..."
                rows={8}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-yellow-400 text-sm transition-colors resize-none leading-relaxed"
              />
              {pageContent && (
                <div className="mt-1 text-xs text-zinc-600 text-right">
                  {pageContent.split(/\s+/).filter(Boolean).length} words
                </div>
              )}
            </div>

            {/* CTA */}
            <button
              onClick={runAudit}
              disabled={isAuditing || !headline.trim()}
              className={`w-full py-4 rounded-lg font-black text-lg tracking-tight transition-all ${
                isAuditing || !headline.trim()
                  ? "bg-yellow-400/50 text-black/50 cursor-not-allowed"
                  : "bg-yellow-400 hover:bg-yellow-300 text-black cursor-pointer"
              }`}
            >
              {isAuditing ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Auditing…
                </span>
              ) : "Run Conversion Audit"}
            </button>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}
          </div>

          {/* ── Right: Results ── */}
          <div>
            {!result && !isAuditing && (
              <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-zinc-600 bg-zinc-900 border border-zinc-800 rounded-lg p-8">
                <div className="text-4xl mb-3">📊</div>
                <div className="text-sm text-center leading-relaxed">
                  Enter your headline and hit Audit.<br />
                  Get a CRO score, priority fixes,<br />
                  and 3 headline alternatives.
                </div>
              </div>
            )}

            {isAuditing && (
              <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-zinc-500 bg-zinc-900 border border-zinc-800 rounded-lg p-8">
                <svg className="animate-spin h-8 w-8 text-yellow-400 mb-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <div className="text-sm animate-pulse">Analysing your page…</div>
              </div>
            )}

            {result && grade && (
              <div className="space-y-5">

                {/* Overall score */}
                <div className={`bg-zinc-900 border ${grade.ring} rounded-lg p-5 flex items-center justify-between`}>
                  <div>
                    <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-1">
                      Conversion Score
                    </div>
                    <div className={`text-4xl font-black ${grade.color}`}>
                      {result.overall_score}<span className="text-xl text-zinc-600">/100</span>
                    </div>
                    <div className={`text-sm font-semibold mt-1 ${grade.color}`}>{grade.label}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-zinc-600 mb-2">Benchmark breakdown</div>
                    <div className="space-y-1">
                      {(Object.entries(result.benchmark_scores) as [keyof BenchmarkScores, number][]).map(([key, val]) => (
                        <div key={key} className="flex items-center gap-2 justify-end">
                          <span className="text-xs text-zinc-500 w-32 text-right">{BENCHMARK_LABELS[key]}</span>
                          <div className="w-20 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${scoreBg(val)}`}
                              style={{ width: `${val * 10}%` }}
                            />
                          </div>
                          <span className={`text-xs font-bold w-6 text-right ${scoreColor(val)}`}>{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Pain point coverage */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
                  <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">
                    Pain Point Coverage
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(result.pain_point_clusters as PainPointCluster[]).map((cluster) => (
                      <div
                        key={cluster.category}
                        className={`flex items-start gap-2 p-2.5 rounded-lg border text-xs ${
                          cluster.status === "present"
                            ? "border-green-400/20 bg-green-400/5"
                            : "border-red-400/20 bg-red-400/5"
                        }`}
                      >
                        <span className={cluster.status === "present" ? "text-green-400" : "text-red-400"}>
                          {cluster.status === "present" ? "✓" : "✗"}
                        </span>
                        <div>
                          <div className={`font-semibold capitalize ${
                            cluster.status === "present" ? "text-zinc-300" : "text-zinc-500"
                          }`}>
                            {cluster.category}
                          </div>
                          {cluster.quote && (
                            <div className="text-zinc-600 mt-0.5 leading-snug italic">
                              &ldquo;{cluster.quote}&rdquo;
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommendations */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
                  <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">
                    Priority Fixes
                  </div>
                  <div className="space-y-4">
                    {(result.recommendations as Recommendation[]).map((rec) => (
                      <div key={rec.priority} className="flex gap-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-400/15 border border-yellow-400/30 flex items-center justify-center text-yellow-400 text-xs font-bold">
                          {rec.priority}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-white">{rec.action}</div>
                          <div className="text-xs text-zinc-500 mt-0.5">{rec.impact}</div>
                          {rec.example && (
                            <div className="mt-2 text-xs bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-300 leading-relaxed italic">
                              &ldquo;{rec.example}&rdquo;
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Headline variants — A/B tester */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
                      A/B Headline Variants
                    </div>
                    <div className="text-xs text-zinc-600">Hit "Test" to score each vs your original</div>
                  </div>

                  {/* Original baseline */}
                  <div className="mb-3 flex items-center gap-3 bg-zinc-800/60 border border-zinc-700 rounded-lg px-4 py-2.5">
                    <span className="text-xs font-bold text-zinc-500 w-14 flex-shrink-0">ORIGINAL</span>
                    <span className="text-sm text-zinc-400 flex-1 leading-snug italic">{headline}</span>
                    <span className="flex-shrink-0 text-xs font-black text-yellow-400 bg-yellow-400/10 border border-yellow-400/30 rounded px-2 py-0.5">
                      {originalHeadlineScore !== null ? originalHeadlineScore : "—"}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {result.headline_variants.map((variant, idx) => {
                      const vScore    = variantScores[idx];
                      const isTesting = testingIdx === idx;
                      const baseline  = originalHeadlineScore ?? result.overall_score;
                      const delta     = vScore !== undefined ? vScore - baseline : null;
                      const angleLabel = (["⚡ Speed", "💰 Money", "🔥 Pain"] as const)[idx] ?? `Variant ${idx + 1}`;

                      return (
                        <div
                          key={idx}
                          className={`rounded-lg border px-4 py-3 transition-all ${
                            vScore !== undefined
                              ? delta! > 0
                                ? "border-green-400/40 bg-green-400/5"
                                : delta! < 0
                                  ? "border-red-400/30 bg-red-400/5"
                                  : "border-zinc-600 bg-zinc-800"
                              : "border-zinc-700 bg-zinc-800"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-xs text-zinc-500 mt-0.5 flex-shrink-0 w-16">{angleLabel}</span>
                            <span className="text-sm text-zinc-100 flex-1 leading-snug">{variant}</span>

                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {/* Score badge */}
                              {vScore !== undefined && (
                                <div className="flex items-center gap-1">
                                  <span className={`text-xs font-black px-2 py-0.5 rounded border ${
                                    delta! > 0
                                      ? "text-green-400 bg-green-400/10 border-green-400/30"
                                      : delta! < 0
                                        ? "text-red-400 bg-red-400/10 border-red-400/30"
                                        : "text-zinc-400 bg-zinc-700 border-zinc-600"
                                  }`}>
                                    {vScore}
                                  </span>
                                  <span className={`text-xs font-bold ${delta! > 0 ? "text-green-400" : delta! < 0 ? "text-red-400" : "text-zinc-500"}`}>
                                    {delta! > 0 ? `+${delta}` : delta}
                                  </span>
                                  {delta! > 0 && (
                                    <span className="text-xs text-green-400 font-bold">Winner ✓</span>
                                  )}
                                </div>
                              )}

                              {/* Test button */}
                              {vScore === undefined && (
                                <button
                                  onClick={() => testVariant(variant, idx)}
                                  disabled={isTesting || testingIdx !== null}
                                  className="text-xs px-2.5 py-1 rounded bg-yellow-400/15 border border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  {isTesting ? (
                                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                  ) : "Test"}
                                </button>
                              )}

                              {/* Copy */}
                              <button
                                onClick={() => copyVariant(variant, idx)}
                                className="text-xs px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-400 hover:text-white transition-all"
                              >
                                {copiedIdx === idx ? "✓" : "Copy"}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Lead magnet brief */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
                  <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">
                    Lead Magnet Idea
                  </div>
                  <p className="text-sm text-zinc-300 leading-relaxed">
                    {result.lead_magnet_brief}
                  </p>
                </div>

                {/* Re-audit */}
                <button
                  onClick={runAudit}
                  className="w-full py-2.5 border border-zinc-700 hover:border-zinc-500 rounded-lg text-zinc-400 hover:text-white text-sm transition-all"
                >
                  Re-audit ↻
                </button>

              </div>
            )}
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-zinc-800 text-center text-zinc-600 text-xs">
          Conversion audit generated by PRICEIT AI. Recommendations are AI-generated — validate with real user data before shipping.
        </div>
      </div>
    </div>
  );
}
