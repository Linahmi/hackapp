"use client";

import { useState } from "react";

export interface IntelExcerpt {
  title: string;
  content: string;
  url: string;
}

export interface SupplierIntelResult {
  supplier: string;
  excerpts: IntelExcerpt[];
  searchQuery: string;
}

interface Props {
  results: SupplierIntelResult[];
  loading?: boolean;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

function ExcerptCard({ excerpt }: { excerpt: IntelExcerpt }) {
  return (
    <a
      href={excerpt.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition-colors hover:bg-white/[0.05] hover:border-white/10"
    >
      <p className="text-sm font-medium text-gray-200 leading-snug line-clamp-1">
        {excerpt.title || "Untitled"}
      </p>
      <p className="mt-1.5 text-xs text-gray-500 leading-relaxed line-clamp-2">
        {excerpt.content}
      </p>
      <span className="mt-2 inline-flex items-center gap-1.5 text-[10px] text-gray-600">
        <span className="h-1 w-1 rounded-full bg-gray-600" />
        {extractDomain(excerpt.url)}
      </span>
    </a>
  );
}

function SupplierSection({ result }: { result: SupplierIntelResult }) {
  const [expanded, setExpanded] = useState(false);
  const hasResults = result.excerpts.length > 0;
  const visible = expanded ? result.excerpts : result.excerpts.slice(0, 2);

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#13151F] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#3B82F6]/15 border border-[#3B82F6]/25">
            <svg className="h-3.5 w-3.5 text-[#3B82F6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div>
            <span className="text-sm font-semibold text-[color:var(--text-main)]">
              {result.supplier}
            </span>
            <span className="ml-2 text-xs text-gray-600">
              {result.excerpts.length} source{result.excerpts.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <svg
          className={`h-4 w-4 text-gray-600 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {hasResults && (
        <div className="px-5 pb-4 flex flex-col gap-2">
          {visible.map((excerpt, i) => (
            <ExcerptCard key={i} excerpt={excerpt} />
          ))}
          {!expanded && result.excerpts.length > 2 && (
            <button
              onClick={() => setExpanded(true)}
              className="text-xs text-[#3B82F6]/70 hover:text-[#3B82F6] transition-colors self-start mt-1"
            >
              +{result.excerpts.length - 2} more sources
            </button>
          )}
        </div>
      )}

      {!hasResults && (
        <div className="px-5 pb-4">
          <p className="text-xs text-gray-600 italic">No market data found for this supplier.</p>
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border border-white/[0.06] bg-[#13151F] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-full bg-white/[0.06]" />
            <div className="h-4 w-32 rounded bg-white/[0.06]" />
          </div>
          <div className="mt-3 space-y-2">
            <div className="h-3 w-full rounded bg-white/[0.04]" />
            <div className="h-3 w-3/4 rounded bg-white/[0.04]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MarketIntelCard({ results, loading }: Props) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#1A1D27] p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#3B82F6]/15">
            <svg className="h-3.5 w-3.5 text-[#3B82F6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-[color:var(--text-main)]">
            Market Intelligence
          </h3>
          <span className="rounded border border-[#3B82F6]/25 bg-[#3B82F6]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#3B82F6] uppercase tracking-wider">
            Live
          </span>
        </div>
        <span className="text-[10px] text-gray-600 uppercase tracking-wider font-medium">
          Powered by Exa AI
        </span>
      </div>

      <p className="text-xs text-gray-600 mb-4">
        Real-time web intelligence — pricing signals, reviews, and availability data gathered from public sources.
      </p>

      {loading ? <LoadingSkeleton /> : (
        <div className="space-y-3">
          {results.map((r) => (
            <SupplierSection key={r.supplier} result={r} />
          ))}
        </div>
      )}
    </div>
  );
}
