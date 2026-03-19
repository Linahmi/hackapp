import { getData } from './dataLoader';

function getRegion(countries) {
  if (!countries || !countries.length) return null;
  const EU_COUNTRIES = new Set(["AT","BE","BG","CY","CZ","DE","DK","EE","ES","FI","FR","GR","HR","HU","IE","IT","LT","LU","LV","MT","NL","PL","PT","RO","SE","SI","SK","CH","UK"]);
  const US_COUNTRIES = new Set(["US","CA","BR","MX"]);
  const APAC_COUNTRIES = new Set(["SG","AU","JP","IN"]);

  if (countries.some(c => US_COUNTRIES.has(c))) return "US";
  if (countries.some(c => APAC_COUNTRIES.has(c))) return "APAC";
  if (countries.some(c => EU_COUNTRIES.has(c))) return "EU";
  return null;
}

export function detectBundlingOpportunity(currentRequest, rankedSuppliers) {
  // No compliant supplier → no bundle. This is the primary guard.
  if (!rankedSuppliers || rankedSuppliers.length === 0) return null;
  if (!currentRequest || !currentRequest.category_l2 || !currentRequest.quantity) return null;

  const topSupplier = rankedSuppliers[0];
  const { requests, pricing, suppliers } = getData();
  
  const currentRegion = getRegion(currentRequest.delivery_countries);
  if (!currentRegion) return null;

  const currentReqDate = new Date(currentRequest.required_by_date || Date.now());

  // Find similar requests (open, same category, same region, within 30 days)
  const similarRequests = (requests || []).filter(r => {
    if (r.request_id === currentRequest.request_id) return false;
    if (r.category_l2 !== currentRequest.category_l2) return false;
    if (!['new', 'open', 'approved'].includes(r.status)) return false; 
    
    const rRegion = getRegion(r.delivery_countries);
    if (rRegion !== currentRegion) return false;

    if (!r.quantity) return false;

    if (r.required_by_date) {
      const rDate = new Date(r.required_by_date);
      const diffDays = Math.abs((rDate - currentReqDate) / (1000 * 60 * 60 * 24));
      if (diffDays > 30) return false;
    }

    return true;
  });

  if (similarRequests.length === 0) return null;

  const combinedQuantity = currentRequest.quantity + similarRequests.reduce((sum, r) => sum + r.quantity, 0);

  // Capacity check
  const supplierRecord = (suppliers || []).find(s => s.supplier_id === topSupplier.supplier_id && s.category_l2 === currentRequest.category_l2);
  const capacity = supplierRecord && supplierRecord.capacity_per_month ? Number(supplierRecord.capacity_per_month) : Infinity;
  
  if (combinedQuantity > capacity) return null;

  // Pricing tier check
  const supplierPricing = (pricing || []).filter(p => 
    p.supplier_id === topSupplier.supplier_id && 
    p.category_l2 === currentRequest.category_l2 &&
    p.region === currentRegion &&
    p.currency === (currentRequest.currency || 'EUR')
  );

  const getCurrentTier = (qty) => supplierPricing.find(p => Number(p.min_quantity) <= qty && (Number(p.max_quantity) === 0 || Number(p.max_quantity) >= qty));
  
  const currentTier = getCurrentTier(currentRequest.quantity);
  const bundledTier = getCurrentTier(combinedQuantity);

  if (!currentTier || !bundledTier) return null;

  const currentUnitPrice = Number(currentTier.unit_price);
  const bundledUnitPrice = Number(bundledTier.unit_price);

  if (bundledUnitPrice >= currentUnitPrice) return null;

  const estimatedSaving = (currentUnitPrice - bundledUnitPrice) * currentRequest.quantity;
  if (estimatedSaving <= 0) return null;

  const savingPct = Math.round(((currentUnitPrice - bundledUnitPrice) / currentUnitPrice) * 100);

  // Forward projection
  let dynamic_pricing_projection = null;
  const betterTiers = supplierPricing.filter(p => Number(p.unit_price) < bundledUnitPrice).sort((a,b) => Number(a.min_quantity) - Number(b.min_quantity));
  
  if (betterTiers.length > 0) {
    const nextTier = betterTiers[0];
    const unitsNeeded = Number(nextTier.min_quantity) - combinedQuantity;
    if (unitsNeeded > 0) {
      const additionalSaving = (bundledUnitPrice - Number(nextTier.unit_price)) * currentRequest.quantity;
      dynamic_pricing_projection = {
        units_needed: unitsNeeded,
        additional_saving: additionalSaving,
        additional_saving_currency: currentRequest.currency || 'EUR',
        message: `Adding ${unitsNeeded} more units from future requests could unlock the next pricing tier, generating an additional ${Math.round(additionalSaving)} ${currentRequest.currency || 'EUR'} in savings for this specific request.`
      };
    }
  }

  // ESG bonus
  let esg_benefit = null;
  if (similarRequests.length >= 2) {
    esg_benefit = "Consolidating these orders drastically reduces fragmented LTL (Less Than Truckload) shipments, positively contributing to Scope 3 emission targets.";
  }

  return {
    opportunity_detected: true,
    type: "consortia_bundling",
    title: "Cross-Client Aggregation Available",
    description: `We identified ${similarRequests.length} similar candidate requests within the ${currentRegion} region over the adjacent 30-day window. Bundling them unlocks a higher volume discount with ${topSupplier.supplier_name} without exposing confidential details.`,
    current_quantity: currentRequest.quantity,
    combined_quantity: combinedQuantity,
    similar_requests_count: similarRequests.length,
    current_unit_price: currentUnitPrice,
    bundled_unit_price: bundledUnitPrice,
    estimated_saving: estimatedSaving,
    saving_pct: savingPct,
    currency: currentRequest.currency || 'EUR',
    esg_benefit,
    dynamic_pricing_projection,
    antitrust_note: "Identities of other requestors and their respective business units are strictly segregated. Only anonymized aggregation metrics are utilized for supplier leverage.",
    requires_manager_approval: estimatedSaving > 5000,
    region: currentRegion
  };
}
