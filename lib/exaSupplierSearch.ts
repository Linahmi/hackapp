/**
 * Exa AI-powered supplier search (replaces Tavily).
 * Uses the Exa REST API — no SDK dependency.
 */

export interface SupplierIntel {
  supplier: string;
  excerpts: { title: string; content: string; url: string }[];
  searchQuery: string;
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
    return { supplier: supplierName, excerpts: [], searchQuery: query };
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
      return { supplier: supplierName, excerpts: [], searchQuery: query };
    }

    const data = await res.json();

    const excerpts = (data.results ?? []).map((r: any) => ({
      title: r.title ?? "",
      content: r.text ?? r.snippet ?? "",
      url: r.url ?? "",
    }));

    return { supplier: supplierName, excerpts, searchQuery: query };
  } catch (err) {
    console.error(`[Exa] Search failed for "${supplierName}":`, err);
    return { supplier: supplierName, excerpts: [], searchQuery: query };
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
      : { supplier: suppliers[i], excerpts: [], searchQuery: "" },
  );
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
    return [{ supplier: `External sourcing candidates`, excerpts: [], searchQuery: query }];
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
      return [{ supplier: `External sourcing candidates`, excerpts: [], searchQuery: query }];
    }

    const data = await res.json();
    const excerpts = (data.results ?? []).map((r: any) => ({
      title: r.title ?? "",
      content: r.text ?? r.snippet ?? "",
      url: r.url ?? "",
    }));

    return [
      {
        supplier: `External sourcing candidates`,
        excerpts,
        searchQuery: query,
      },
    ];
  } catch (err) {
    console.error(`[Exa] Discovery search failed for "${productCategory}":`, err);
    return [{ supplier: `External sourcing candidates`, excerpts: [], searchQuery: query }];
  }
}
