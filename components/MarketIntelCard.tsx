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
      className="block rounded-xl border border-gray-200 dark:border-white/[0.06] bg-gray-50/50 dark:bg-white/[0.02] px-5 py-4 transition-all hover:bg-gray-100 dark:hover:bg-white/[0.05] hover:border-gray-300 dark:hover:border-white/10 shadow-sm hover:shadow"
    >
      <p className="text-sm font-bold text-gray-900 dark:text-gray-200 leading-snug line-clamp-1">
        {excerpt.title || "Untitled"}
      </p>
      <p className="mt-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-2">
        {excerpt.content}
      </p>
      <span className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-bold text-gray-500 dark:text-gray-500">
        <span className="h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-gray-600" />
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
    <div className="rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-[#13151F] overflow-hidden shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-6 py-4 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 dark:bg-[#3B82F6]/15 border border-blue-200 dark:border-[#3B82F6]/25">
            <svg className="h-4 w-4 text-blue-600 dark:text-[#3B82F6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div>
            <span className="text-base font-bold text-gray-900 dark:text-white">
              {result.supplier}
            </span>
            <span className="ml-3 text-xs font-bold text-gray-500 dark:text-gray-500">
              {result.excerpts.length} source{result.excerpts.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <svg
          className={`h-5 w-5 text-gray-400 dark:text-gray-600 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {hasResults && (
        <div className="px-6 pb-5 flex flex-col gap-3 border-t border-gray-100 dark:border-white/5 pt-4">
          {visible.map((excerpt, i) => (
            <ExcerptCard key={i} excerpt={excerpt} />
          ))}
          {!expanded && result.excerpts.length > 2 && (
            <button
              onClick={() => setExpanded(true)}
              className="text-xs font-bold text-blue-600 dark:text-[#3B82F6]/70 hover:text-blue-800 dark:hover:text-[#3B82F6] transition-colors self-start mt-2"
            >
              +{result.excerpts.length - 2} more sources
            </button>
          )}
        </div>
      )}

      {!hasResults && (
        <div className="px-6 pb-5 pt-2">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-600 italic">No public market signals were retrieved for this supplier.</p>
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-[#13151F] px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-white/[0.06]" />
            <div className="h-5 w-40 rounded bg-gray-200 dark:bg-white/[0.06]" />
          </div>
          <div className="mt-4 space-y-2.5">
            <div className="h-3 w-full rounded bg-gray-100 dark:bg-white/[0.04]" />
            <div className="h-3 w-3/4 rounded bg-gray-100 dark:bg-white/[0.04]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MarketIntelCard({ results, loading }: Props) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1A1D27] p-6 shadow-sm mb-16 transition-colors duration-300">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-[#3B82F6]/15 border border-blue-200 dark:border-[#3B82F6]/30">
            <svg className="h-4 w-4 text-blue-600 dark:text-[#3B82F6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            Market Intelligence
          </h3>
          <span className="rounded-full border border-blue-200 dark:border-[#3B82F6]/25 bg-blue-50 dark:bg-[#3B82F6]/10 px-2.5 py-1 text-[10px] font-bold text-blue-600 dark:text-[#3B82F6] uppercase tracking-widest">
            External Signal
          </span>
        </div>
        <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest font-bold">
          Powered by Exa AI
        </span>
      </div>

      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 max-w-2xl">
        Public web signals gathered through Exa to enrich the sourcing view with pricing, reviews, and availability context.
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-6 max-w-2xl">
        These signals support the recommendation, but they do not override procurement policy or approved-supplier rules.
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
