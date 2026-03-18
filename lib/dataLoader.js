import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data");

function readCSV(filename) {
  const content = readFileSync(join(DATA_DIR, filename), "utf-8");
  return parse(content, { columns: true, skip_empty_lines: true, cast: true });
}

function readJSON(filename) {
  return JSON.parse(readFileSync(join(DATA_DIR, filename), "utf-8"));
}

let _cache = null;

export function loadData() {
  if (_cache) return _cache;

  const suppliers = readCSV("suppliers.csv").map((s) => ({
    ...s,
    service_regions: String(s.service_regions).split(";"),
    preferred_supplier: s.preferred_supplier === true || s.preferred_supplier === "True",
    is_restricted: s.is_restricted === true || s.is_restricted === "True",
    data_residency_supported: s.data_residency_supported === true || s.data_residency_supported === "True",
  }));

  const pricing = readCSV("pricing.csv");

  const historicalAwards = readCSV("historical_awards.csv");

  const policies = readJSON("policies.json");

  _cache = { suppliers, pricing, policies, historicalAwards };
  return _cache;
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
    const tier = pricing.find(
      (p) =>
        p.supplier_id === sup.supplier_id &&
        p.category_l1 === category_l1 &&
        p.category_l2 === category_l2 &&
        p.region === region &&
        Number(p.min_quantity) <= quantity &&
        (Number(p.max_quantity) >= quantity || Number(p.max_quantity) === 0)
    );

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
