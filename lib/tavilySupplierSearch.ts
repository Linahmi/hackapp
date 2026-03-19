import { tavily } from "@tavily/core";

const client = tavily({ apiKey: process.env.TAVILY_API_KEY ?? "" });

export interface SupplierIntel {
  supplier: string;
  excerpts: { title: string; content: string; url: string }[];
  searchQuery: string;
}

/**
 * Searches the web for real-time market intelligence about a supplier
 * in the context of a product category and region.
 */
export async function searchSupplier(
  supplierName: string,
  productCategory: string,
  region?: string,
): Promise<SupplierIntel> {
  const regionClause = region ? ` ${region}` : "";
  const query = `${supplierName} ${productCategory} pricing reviews availability${regionClause} 2025 2026`;

  try {
    const response = await client.search(query, {
      maxResults: 5,
      searchDepth: "basic",
      includeAnswer: false,
    });

    const excerpts = (response.results ?? []).map((r) => ({
      title: r.title ?? "",
      content: r.content ?? "",
      url: r.url ?? "",
    }));

    return { supplier: supplierName, excerpts, searchQuery: query };
  } catch (err) {
    console.error(`[Tavily] Search failed for "${supplierName}":`, err);
    return { supplier: supplierName, excerpts: [], searchQuery: query };
  }
}

/**
 * Searches for multiple suppliers in parallel.
 */
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
