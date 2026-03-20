/**
 * Exa AI-powered supplier search (replaces Tavily).
 * Uses the Exa REST API — no SDK dependency.
 */

export interface SupplierIntel {
  supplier: string;
  excerpts: { title: string; content: string; url: string }[];
  searchQuery: string;
  suggestedCandidate?: { name: string; reason: string; url: string } | null;
}

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

    const excerpts = (data.results ?? []).map((r: any) => ({
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

function buildSuggestedCandidate(results: any[], productCategory: string, region?: string) {
  if (!results?.length) return null;

  const categoryWords = productCategory.toLowerCase().split(/\s+/).filter(Boolean);
  const regionWords = (region ?? "").toLowerCase().split(/\s+/).filter(Boolean);

  const scored = results.map((r: any) => {
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
    return [{ supplier: `External sourcing candidates`, excerpts: [], searchQuery: query, suggestedCandidate: null }];
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
      return [{ supplier: `External sourcing candidates`, excerpts: [], searchQuery: query, suggestedCandidate: null }];
    }

    const data = await res.json();
    const rawResults = data.results ?? [];
    const excerpts = rawResults.map((r: any) => ({
      title: r.title ?? "",
      content: r.text ?? r.snippet ?? "",
      url: r.url ?? "",
    }));
    const suggestedCandidate = buildSuggestedCandidate(rawResults, productCategory, region);

    return [
      {
        supplier: `External sourcing candidates`,
        excerpts,
        searchQuery: query,
        suggestedCandidate,
      },
    ];
  } catch (err) {
    console.error(`[Exa] Discovery search failed for "${productCategory}":`, err);
    return [{ supplier: `External sourcing candidates`, excerpts: [], searchQuery: query, suggestedCandidate: null }];
  }
}
