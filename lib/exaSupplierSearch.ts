/**
 * Exa AI-powered supplier search (replaces Tavily).
 * Uses the Exa REST API — no SDK dependency.
 */

import { loadData } from "./dataLoader.js";

export interface SupplierIntel {
  supplier: string;
  excerpts: { title: string; content: string; url: string }[];
  searchQuery: string;
  suggestedCandidate?: { name: string; reason: string; url: string; source: "exa" | "dataset_fallback" } | null;
}

type SupplierRow = {
  supplier_id?: string;
  supplier_name?: string;
  category_l1?: string;
  category_l2?: string;
  service_regions?: string[];
  preferred_supplier?: boolean;
  is_restricted?: boolean;
  contract_status?: string;
  quality_score?: number;
  risk_score?: number;
  esg_score?: number;
};

type PricingRow = {
  supplier_id?: string;
  category_l1?: string;
  category_l2?: string;
  region?: string;
  standard_lead_time_days?: number;
};

type ExaResultRow = {
  title?: string;
  text?: string;
  snippet?: string;
  url?: string;
};

export async function searchSupplier(
  supplierName: string,
  productCategory: string,
  region?: string,
): Promise<SupplierIntel> {
  const regionClause = region ? ` ${region}` : "";
  const query = `${supplierName} ${productCategory} pricing reviews availability${regionClause} 2025 2026`;

  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    console.warn("[Exa] No EXA_API_KEY set — returning empty results");
    return { supplier: supplierName, excerpts: [], searchQuery: query, suggestedCandidate: null };
  }

  try {
    const res = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        query,
        type: "auto",
        numResults: 5,
        contents: {
          text: { maxCharacters: 500 },
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[Exa] API error ${res.status}:`, err);
      return { supplier: supplierName, excerpts: [], searchQuery: query, suggestedCandidate: null };
    }

    const data = await res.json();

    const excerpts = ((data.results ?? []) as ExaResultRow[]).map((r) => ({
      title: r.title ?? "",
      content: r.text ?? r.snippet ?? "",
      url: r.url ?? "",
    }));

    return { supplier: supplierName, excerpts, searchQuery: query, suggestedCandidate: null };
  } catch (err) {
    console.error(`[Exa] Search failed for "${supplierName}":`, err);
    return { supplier: supplierName, excerpts: [], searchQuery: query, suggestedCandidate: null };
  }
}

export async function searchSuppliers(
  suppliers: string[],
  productCategory: string,
  region?: string,
): Promise<SupplierIntel[]> {
  const results = await Promise.allSettled(
    suppliers.map((s) => searchSupplier(s, productCategory, region)),
  );

  return results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : { supplier: suppliers[i], excerpts: [], searchQuery: "", suggestedCandidate: null },
  );
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function titleToCandidateName(title: string, url: string): string {
  const source = title || extractDomain(url);
  const split = source.split(/[-|:]/)[0]?.trim() || source;
  return split.replace(/\s+/g, " ").trim();
}

function toWords(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/i).filter((word) => word.length > 1);
}

function wordOverlapScore(a: string, b: string): number {
  const aWords = new Set(toWords(a));
  const bWords = toWords(b);
  return bWords.reduce((score, word) => score + (aWords.has(word) ? 1 : 0), 0);
}

function buildDatasetFallbackCandidate(productCategory: string, region?: string) {
  const { suppliers, pricing } = loadData() as { suppliers: SupplierRow[]; pricing: PricingRow[] };
  const normalizedCategory = productCategory.toLowerCase();
  const normalizedRegion = (region ?? "").toLowerCase();

  const scoredRows = suppliers
    .filter((row) => !row.is_restricted)
    .map((row) => {
      const categoryText = `${row.category_l1 ?? ""} ${row.category_l2 ?? ""}`.trim();
      const categoryScore =
        (row.category_l2 ?? "").toLowerCase() === normalizedCategory
          ? 10
          : wordOverlapScore(categoryText, productCategory) * 2;
      const regionScore = (row.service_regions ?? []).some((serviceRegion) => serviceRegion.toLowerCase() === normalizedRegion)
        ? 3
        : normalizedRegion && (row.service_regions ?? []).some((serviceRegion) => normalizedRegion.includes(serviceRegion.toLowerCase()) || serviceRegion.toLowerCase().includes(normalizedRegion))
        ? 2
        : 0;
      const commercialScore =
        (row.preferred_supplier ? 2 : 0)
        + (String(row.contract_status ?? "").toLowerCase() === "active" ? 1 : 0)
        + ((Number(row.quality_score) || 0) >= 80 ? 1 : 0)
        + ((Number(row.risk_score) || 100) <= 25 ? 1 : 0);

      return {
        row,
        score: categoryScore + regionScore + commercialScore,
      };
    })
    .filter((entry) => entry.score > 0);

  scoredRows.sort((a, b) => b.score - a.score);
  const best = scoredRows[0]?.row;
  if (!best?.supplier_name) return null;

  const matchingPricing = pricing.filter(
    (priceRow) =>
      priceRow.supplier_id === best.supplier_id &&
      priceRow.category_l2 === best.category_l2 &&
      priceRow.category_l1 === best.category_l1,
  );

  const pricedRegions = Array.from(new Set(matchingPricing.map((row) => row.region).filter(Boolean))).join(", ");
  const leadTime = matchingPricing
    .map((row) => Number(row.standard_lead_time_days))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b)[0];
  const supportedRegions = (best.service_regions ?? []).slice(0, 4).join(", ");

  const reasonParts = [
    `Exa could not return a live candidate, so the app proposed the nearest known supplier from the current supplier master for ${productCategory}.`,
    `${best.supplier_name} already covers ${best.category_l2 ?? best.category_l1 ?? "this category"}`,
    supportedRegions ? `with service coverage including ${supportedRegions}` : null,
    pricedRegions ? `and pricing data available for ${pricedRegions}` : null,
    Number.isFinite(leadTime) ? `with a documented standard lead time from ${leadTime} days` : null,
    best.preferred_supplier ? "It is also flagged as a preferred supplier in the internal dataset." : null,
  ].filter(Boolean);

  return {
    name: best.supplier_name,
    reason: reasonParts.join(" "),
    url: "",
    source: "dataset_fallback" as const,
  };
}

function buildSuggestedCandidate(results: ExaResultRow[], productCategory: string, region?: string) {
  if (!results?.length) return buildDatasetFallbackCandidate(productCategory, region);

  const categoryWords = productCategory.toLowerCase().split(/\s+/).filter(Boolean);
  const regionWords = (region ?? "").toLowerCase().split(/\s+/).filter(Boolean);

  const scored = results.map((r) => {
    const haystack = `${r.title ?? ""} ${r.text ?? r.snippet ?? ""} ${r.url ?? ""}`.toLowerCase();
    let score = 0;
    for (const word of categoryWords) {
      if (word.length > 2 && haystack.includes(word)) score += 2;
    }
    for (const word of regionWords) {
      if (word.length > 1 && haystack.includes(word)) score += 1;
    }
    if (/supplier|vendor|distributor|reseller|manufacturer/.test(haystack)) score += 2;
    if (/pricing|availability|lead time|delivery|enterprise/.test(haystack)) score += 1;
    return { result: r, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0]?.result;
  if (!best) return null;

  const candidateName = titleToCandidateName(best.title ?? "", best.url ?? "");
  const reasonParts = [
    `Most relevant external lead surfaced by Exa for ${productCategory}`,
    region ? `with signals tied to ${region}` : null,
    /pricing|availability|delivery|lead time/i.test(`${best.title ?? ""} ${best.text ?? ""}`)
      ? "and public references to commercial availability or fulfillment"
      : "and the strongest match among the retrieved public sources",
  ].filter(Boolean);

  return {
    name: candidateName,
    reason: `${reasonParts.join(" ")}.`,
    url: best.url ?? "",
    source: "exa" as const,
  };
}

export async function searchMarketCandidates(
  productCategory: string,
  region?: string,
): Promise<SupplierIntel[]> {
  const regionClause = region ? ` in ${region}` : "";
  const query = `enterprise suppliers distributors vendors for ${productCategory}${regionClause} pricing availability 2025 2026`;

  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    console.warn("[Exa] No EXA_API_KEY set — returning empty discovery results");
    return [{
      supplier: "External sourcing candidates",
      excerpts: [],
      searchQuery: query,
      suggestedCandidate: buildDatasetFallbackCandidate(productCategory, region),
    }];
  }

  try {
    const res = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        query,
        type: "auto",
        numResults: 6,
        contents: {
          text: { maxCharacters: 500 },
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[Exa] Discovery API error ${res.status}:`, err);
      return [{
        supplier: "External sourcing candidates",
        excerpts: [],
        searchQuery: query,
        suggestedCandidate: buildDatasetFallbackCandidate(productCategory, region),
      }];
    }

    const data = await res.json();
    const rawResults = (data.results ?? []) as ExaResultRow[];
    const excerpts = rawResults.map((r) => ({
      title: r.title ?? "",
      content: r.text ?? r.snippet ?? "",
      url: r.url ?? "",
    }));
    const suggestedCandidate = buildSuggestedCandidate(rawResults, productCategory, region);

    return [
      {
        supplier: "External sourcing candidates",
        excerpts,
        searchQuery: query,
        suggestedCandidate,
      },
    ];
  } catch (err) {
    console.error(`[Exa] Discovery search failed for "${productCategory}":`, err);
    return [{
      supplier: "External sourcing candidates",
      excerpts: [],
      searchQuery: query,
      suggestedCandidate: buildDatasetFallbackCandidate(productCategory, region),
    }];
  }
}
