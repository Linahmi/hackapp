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

    // Find matching pricing tier
    const matchTier = (r) => pricing.find(
      (p) =>
        p.supplier_id === sup.supplier_id &&
        p.category_l1 === category_l1 &&
        p.category_l2 === category_l2 &&
        p.region === r &&
        Number(p.min_quantity) <= quantity &&
        (Number(p.max_quantity) >= quantity || Number(p.max_quantity) === 0)
    );

    // For CH requests: fall back to EU pricing when no CH-specific tier exists.
    // Most categories only have EU pricing; CH-specific rows exist only for
    // Cloud and Professional Services categories.
    const tier = matchTier(region) ?? (region === "CH" ? matchTier("EU") : undefined);

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
