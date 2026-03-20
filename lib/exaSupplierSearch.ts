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
  liveCandidates?: {
    name: string;
    url: string;
    reason: string;
    score: number;
    sourceCount: number;
    source: "exa" | "dataset_fallback";
  }[];
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch("https://api.exa.ai/search", {
      method: "POST",
      signal: AbortSignal.timeout(8000),
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
      signal: controller.signal,
    });
    clearTimeout(timeout);

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

function inferPricingRegion(region?: string): "EU" | "US" | "APAC" | "CH" | null {
  if (!region) return null;
  const normalized = region.trim().toUpperCase();
  const euCountries = new Set([
    "AT", "BE", "BG", "CH", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HR", "HU",
    "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK", "UK",
  ]);
  const usCountries = new Set(["US", "CA", "BR", "MX"]);
  const apacCountries = new Set(["SG", "AU", "JP", "IN", "UAE"]);

  if (normalized === "CH" || normalized === "SWITZERLAND") return "CH";
  if (euCountries.has(normalized)) return "EU";
  if (usCountries.has(normalized)) return "US";
  if (apacCountries.has(normalized)) return "APAC";
  if (/(EUROPE|GERMANY|FRANCE|NETHERLANDS|BELGIUM|SWITZERLAND|ITALY|SPAIN|POLAND|AUSTRIA)/i.test(region)) return "EU";
  if (/(UNITED STATES|CANADA|BRAZIL|MEXICO|AMERICA)/i.test(region)) return "US";
  if (/(SINGAPORE|AUSTRALIA|JAPAN|INDIA|UAE|APAC|ASIA)/i.test(region)) return "APAC";
  return null;
}

function hasDirectCoverage(serviceRegions: string[] | undefined, region?: string): boolean {
  if (!serviceRegions?.length || !region) return false;
  const normalizedRegion = region.trim().toLowerCase();
  return serviceRegions.some((serviceRegion) => {
    const normalizedServiceRegion = serviceRegion.trim().toLowerCase();
    return normalizedServiceRegion === normalizedRegion
      || normalizedRegion.includes(normalizedServiceRegion)
      || normalizedServiceRegion.includes(normalizedRegion);
  });
}

function buildDatasetFallbackCandidate(productCategory: string, region?: string) {
  const { suppliers, pricing } = loadData() as { suppliers: SupplierRow[]; pricing: PricingRow[] };
  const normalizedCategory = productCategory.toLowerCase();
  const targetPricingRegion = inferPricingRegion(region);

  const scoredRows = suppliers
    .filter((row) => !row.is_restricted)
    .map((row) => {
      const categoryText = `${row.category_l1 ?? ""} ${row.category_l2 ?? ""}`.trim();
      const categoryScore =
        (row.category_l2 ?? "").toLowerCase() === normalizedCategory
          ? 14
          : wordOverlapScore(categoryText, productCategory) * 3;

      const matchingPricing = pricing.filter(
        (priceRow) =>
          priceRow.supplier_id === row.supplier_id &&
          priceRow.category_l2 === row.category_l2 &&
          priceRow.category_l1 === row.category_l1,
      );
      const pricedRegions = new Set(matchingPricing.map((priceRow) => String(priceRow.region ?? "")).filter(Boolean));
      const directCoverage = hasDirectCoverage(row.service_regions, region);
      const pricingRegionMatch = targetPricingRegion ? pricedRegions.has(targetPricingRegion) : false;
      const regionScore = directCoverage ? 8 : pricingRegionMatch ? 4 : 0;
      const fastestLeadTime = matchingPricing
        .map((priceRow) => Number(priceRow.standard_lead_time_days))
        .filter((value) => Number.isFinite(value))
        .sort((a, b) => a - b)[0];
      const leadTimeScore = Number.isFinite(fastestLeadTime)
        ? Math.max(0, 4 - Math.floor((fastestLeadTime as number) / 10))
        : 0;
      const commercialScore =
        (row.preferred_supplier ? 2 : 0)
        + (String(row.contract_status ?? "").toLowerCase() === "active" ? 1 : 0)
        + ((Number(row.quality_score) || 0) >= 80 ? 1 : 0)
        + ((Number(row.risk_score) || 100) <= 25 ? 1 : 0)
        + leadTimeScore;

      return {
        row,
        matchingPricing,
        directCoverage,
        pricingRegionMatch,
        score: categoryScore + regionScore + commercialScore,
      };
    })
    .filter((entry) => entry.score > 0);

  scoredRows.sort((a, b) => b.score - a.score);
  const bestEntry = scoredRows[0];
  const best = bestEntry?.row;
  if (!best?.supplier_name || !bestEntry) return null;

  const matchingPricing = bestEntry.matchingPricing;

  const pricedRegions = Array.from(new Set(matchingPricing.map((row) => row.region).filter(Boolean))).join(", ");
  const leadTime = matchingPricing
    .map((row) => Number(row.standard_lead_time_days))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b)[0];
  const supportedRegions = (best.service_regions ?? []).slice(0, 4).join(", ");

  const reasonParts = [
    `Exa could not return a live candidate, so the app proposed the nearest supplier from the current supplier master for ${productCategory}.`,
    bestEntry.directCoverage && region
      ? `${best.supplier_name} directly covers ${region} for ${best.category_l2 ?? best.category_l1 ?? "this category"}`
      : region
      ? `No direct supplier coverage was found for ${region}, so ${best.supplier_name} was selected as the nearest approved match for ${best.category_l2 ?? best.category_l1 ?? "this category"}`
      : `${best.supplier_name} is the strongest internal match for ${best.category_l2 ?? best.category_l1 ?? "this category"}`,
    bestEntry.pricingRegionMatch && targetPricingRegion ? `It has active pricing support for the ${targetPricingRegion} pricing region` : null,
    supportedRegions ? `with documented service coverage including ${supportedRegions}` : null,
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

function buildLiveCandidates(results: ExaResultRow[], productCategory: string, region?: string) {
  if (!results?.length) {
    const fallback = buildDatasetFallbackCandidate(productCategory, region);
    return fallback ? [{
      name: fallback.name,
      url: fallback.url,
      reason: fallback.reason,
      score: 62,
      sourceCount: 1,
      source: "dataset_fallback" as const,
    }] : [];
  }

  const categoryWords = productCategory.toLowerCase().split(/\s+/).filter(Boolean);
  const regionWords = (region ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const aggregate = new Map<string, {
    name: string;
    url: string;
    sourceCount: number;
    bestScore: number;
    directRegionMatch: boolean;
    commercialSignal: boolean;
  }>();

  for (const result of results) {
    const name = titleToCandidateName(result.title ?? "", result.url ?? "");
    if (!name) continue;

    const haystack = `${result.title ?? ""} ${result.text ?? result.snippet ?? ""} ${result.url ?? ""}`.toLowerCase();
    let score = 40;
    for (const word of categoryWords) {
      if (word.length > 2 && haystack.includes(word)) score += 8;
    }
    for (const word of regionWords) {
      if (word.length > 1 && haystack.includes(word)) score += 6;
    }
    const commercialSignal = /pricing|availability|delivery|lead time|distributor|reseller|supplier|vendor|manufacturer/i.test(haystack);
    if (commercialSignal) score += 12;
    const directRegionMatch = regionWords.some((word) => word.length > 1 && haystack.includes(word));
    if (directRegionMatch) score += 8;

    const current = aggregate.get(name) ?? {
      name,
      url: result.url ?? "",
      sourceCount: 0,
      bestScore: 0,
      directRegionMatch: false,
      commercialSignal: false,
    };

    current.sourceCount += 1;
    current.bestScore = Math.max(current.bestScore, score);
    current.directRegionMatch = current.directRegionMatch || directRegionMatch;
    current.commercialSignal = current.commercialSignal || commercialSignal;
    if (!current.url && result.url) current.url = result.url;

    aggregate.set(name, current);
  }

  return Array.from(aggregate.values())
    .sort((a, b) => {
      if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
      return b.sourceCount - a.sourceCount;
    })
    .slice(0, 4)
    .map((candidate, index) => {
      const parts = [
        candidate.directRegionMatch && region
          ? `Live search found market signals tied to ${region}.`
          : region
          ? `Live search found the closest market candidate for ${region}.`
          : "Live search found a relevant market candidate.",
        candidate.commercialSignal
          ? "Public sources reference supply, distribution, or commercial availability."
          : "Public sources show category relevance and vendor presence.",
        candidate.sourceCount > 1
          ? `${candidate.sourceCount} supporting sources were retrieved.`
          : "One supporting source was retrieved.",
      ];

      return {
        name: candidate.name,
        url: candidate.url,
        reason: parts.join(" "),
        score: Math.max(55, Math.min(96, candidate.bestScore - index * 2)),
        sourceCount: candidate.sourceCount,
        source: "exa" as const,
      };
    });
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
      liveCandidates: buildDatasetFallbackCandidate(productCategory, region)
        ? [{
            name: buildDatasetFallbackCandidate(productCategory, region)!.name,
            url: buildDatasetFallbackCandidate(productCategory, region)!.url,
            reason: buildDatasetFallbackCandidate(productCategory, region)!.reason,
            score: 62,
            sourceCount: 1,
            source: "dataset_fallback" as const,
          }]
        : [],
    }];
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch("https://api.exa.ai/search", {
      method: "POST",
      signal: AbortSignal.timeout(8000),
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
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const err = await res.text();
      console.error(`[Exa] Discovery API error ${res.status}:`, err);
      return [{
        supplier: "External sourcing candidates",
        excerpts: [],
        searchQuery: query,
        suggestedCandidate: buildDatasetFallbackCandidate(productCategory, region),
        liveCandidates: buildLiveCandidates([], productCategory, region),
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
    const liveCandidates = buildLiveCandidates(rawResults, productCategory, region);

    return [
      {
        supplier: "External sourcing candidates",
        excerpts,
        searchQuery: query,
        suggestedCandidate,
        liveCandidates,
      },
    ];
  } catch (err) {
    console.error(`[Exa] Discovery search failed for "${productCategory}":`, err);
    return [{
      supplier: "External sourcing candidates",
      excerpts: [],
      searchQuery: query,
      suggestedCandidate: buildDatasetFallbackCandidate(productCategory, region),
      liveCandidates: buildLiveCandidates([], productCategory, region),
    }];
  }
}
