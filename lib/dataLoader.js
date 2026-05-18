import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse/sync'

let _cache = null

export function getData() {
  if (_cache) return _cache

  const dataDir = path.join(process.cwd(), 'data')

  const suppliers = parse(
    fs.readFileSync(path.join(dataDir, 'suppliers.csv'), 'utf-8'),
    { columns: true, skip_empty_lines: true, cast: true }
  ).map((s) => ({
    ...s,
    service_regions: String(s.service_regions).split(";"),
    preferred_supplier: s.preferred_supplier === true || s.preferred_supplier === "True" || s.preferred_supplier === "true",
    is_restricted: s.is_restricted === true || s.is_restricted === "True" || s.is_restricted === "true",
    data_residency_supported: s.data_residency_supported === true || s.data_residency_supported === "True",
  }));

  const pricing = parse(
    fs.readFileSync(path.join(dataDir, 'pricing.csv'), 'utf-8'),
    { columns: true, skip_empty_lines: true, cast: true }
  )

  const historicalAwards = parse(
    fs.readFileSync(path.join(dataDir, 'historical_awards.csv'), 'utf-8'),
    { columns: true, skip_empty_lines: true, cast: true }
  )

  const requests = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'requests.json'), 'utf-8')
  )

  const policies = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'policies.json'), 'utf-8')
  )

  _cache = { suppliers, pricing, historicalAwards, requests, policies }

  // ── Dataset loading confirmation (visible in server logs) ──
  console.log(`✅ Loaded ${suppliers.length} suppliers from suppliers.csv`)
  console.log(`✅ Loaded ${pricing.length} pricing tiers from pricing.csv`)
  console.log(`✅ Loaded ${historicalAwards.length} historical awards from historical_awards.csv`)
  console.log(`✅ Loaded ${requests.length} requests from requests.json`)
  console.log(`✅ Loaded ${policies.approval_thresholds?.length ?? 0} approval thresholds, ${policies.restricted_suppliers?.length ?? 0} restricted suppliers, ${policies.category_rules?.length ?? 0} category rules, ${policies.geography_rules?.length ?? 0} geography rules from policies.json`)

  return _cache
}

// Map A's loadData to B's getData
export function loadData() {
  return getData();
}

/**
 * Get suppliers eligible for a given category + delivery countries.
 * Returns supplier rows with their applicable pricing tier for `quantity`.
 */
export function getEligibleSuppliers(category_l1, category_l2, deliveryCountries, quantity, currency) {
  const { suppliers, pricing } = loadData();

  // Determine pricing region from currency / countries
  const region = deriveRegion(deliveryCountries, currency);

  const eligible = [];

  for (const sup of suppliers) {
    if (sup.category_l1 !== category_l1 || sup.category_l2 !== category_l2) continue;

    // Check the supplier serves at least one delivery country
    const coversCountry = deliveryCountries.some((c) => sup.service_regions.includes(c));
    if (!coversCountry) continue;

    // Find matching pricing tier — if CHF region ("CH") has no rows, fall back to EU.
    // Most categories only have EU pricing; CH-specific rows exist only for
    // Cloud and Professional Services categories.
    const tierMatch = (r) => pricing.find(
      (p) =>
        p.supplier_id === sup.supplier_id &&
        p.category_l1 === category_l1 &&
        p.category_l2 === category_l2 &&
        p.region === r &&
        Number(p.min_quantity) <= quantity &&
        (Number(p.max_quantity) >= quantity || Number(p.max_quantity) === 0)
    );
    const tier = tierMatch(region) ?? (region === "CH" ? tierMatch("EU") : null);

    if (!tier) continue;

    eligible.push({ supplier: sup, tier });
  }

  return eligible;
}

function deriveRegion(countries, currency) {
  const EU_COUNTRIES = new Set([
    "AT","BE","BG","CY","CZ","DE","DK","EE","ES","FI","FR","GR","HR","HU",
    "IE","IT","LT","LU","LV","MT","NL","PL","PT","RO","SE","SI","SK","CH","UK",
  ]);
  const US_COUNTRIES = new Set(["US","CA","BR","MX"]);
  const APAC_COUNTRIES = new Set(["SG","AU","JP","IN"]);

  if (currency === "CHF") return "CH";
  if (countries.some((c) => US_COUNTRIES.has(c))) return "US";
  if (countries.some((c) => APAC_COUNTRIES.has(c))) return "APAC";
  if (countries.some((c) => EU_COUNTRIES.has(c))) return "EU";
  return "EU";
}

export function getHistoricalAwards(category_l1, category_l2, country) {
  const { historicalAwards } = loadData();
  return historicalAwards.filter(
    (a) =>
      a.category_l1 === category_l1 &&
      a.category_l2 === category_l2 &&
      a.country === country
  );
}

/**
 * Find the closest matching category pair using word-overlap (Jaccard) scoring.
 * Returns { category_l1, category_l2, matchScore } or null if nothing scores above threshold.
 */
export function fuzzyMatchCategory(requestedCategory) {
  if (!requestedCategory) return null;
  const { suppliers } = loadData();

  const seen = new Set();
  const pairs = [];
  for (const sup of suppliers) {
    const key = `${sup.category_l1}|${sup.category_l2}`;
    if (!seen.has(key)) {
      seen.add(key);
      pairs.push({ category_l1: sup.category_l1, category_l2: sup.category_l2 });
    }
  }

  const tokenize = str =>
    str.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);

  const reqWords = tokenize(requestedCategory);
  if (!reqWords.length) return null;
  const reqSet = new Set(reqWords);

  let best = null;
  let bestScore = 0;

  for (const pair of pairs) {
    const candidateStr = `${pair.category_l1} ${pair.category_l2}`;
    const candWords = tokenize(candidateStr);
    const candSet = new Set(candWords);

    const intersection = reqWords.filter(w => candSet.has(w)).length;
    const union = new Set([...reqSet, ...candSet]).size;
    let score = union > 0 ? intersection / union : 0;

    // Bonus when the requested category is a substring of the candidate or vice versa
    const reqLow = requestedCategory.toLowerCase();
    const candLow = candidateStr.toLowerCase();
    if (candLow.includes(reqLow) || reqLow.includes(pair.category_l2.toLowerCase())) {
      score += 0.2;
    }

    if (score > bestScore) {
      bestScore = score;
      best = { ...pair, matchScore: score };
    }
  }

  return bestScore >= 0.12 ? best : null;
}

/**
 * Returns a global median unit price across all pricing rows, used as a fallback
 * when no CSV suppliers match the requested category.
 */
export function getGlobalMedianUnitPrice() {
  const { pricing } = loadData();
  const prices = pricing.map(p => Number(p.unit_price)).filter(p => !isNaN(p) && p > 0).sort((a, b) => a - b);
  if (!prices.length) return null;
  return prices[Math.floor(prices.length / 2)];
}
