import { loadData } from "./dataLoader.js";

const WEIGHTS = { price: 0.30, lead_time: 0.30, quality: 0.20, risk: 0.10, esg: 0.10 };

/**
 * Score and rank eligible suppliers for a request.
 * Returns { shortlist, excluded }
 */
export function scoreSuppliers(eligibleSuppliers, policyEvaluation, request) {
  const { quantity, days_until_required, currency = "EUR" } = request;
  const restrictedIds = new Set(
    Object.keys(policyEvaluation.restricted_suppliers ?? {}).map((k) => k.split("_")[0])
  );

  // Pre-pass: determine if any preferred suppliers exist for this category/country
  const hasPreferredAvailable = eligibleSuppliers.some(
    ({ supplier }) => !restrictedIds.has(supplier.supplier_id) && supplier.preferred_supplier
  );
  const maxRiskScore = Math.max(...eligibleSuppliers.map(({ supplier }) => supplier.risk_score));

  const candidates = [];
  const excluded = [];

  for (const { supplier, tier } of eligibleSuppliers) {
    const unitPrice = Number(tier.unit_price);
    const totalPrice = unitPrice * (quantity ?? 1);
    const expeditedUnitPrice = Number(tier.expedited_unit_price);
    const expeditedTotal = expeditedUnitPrice * (quantity ?? 1);
    const stdLeadTime = Number(tier.standard_lead_time_days);
    const expLeadTime = Number(tier.expedited_lead_time_days);

    if (restrictedIds.has(supplier.supplier_id)) {
      excluded.push({
        supplier_id: supplier.supplier_id,
        supplier_name: supplier.supplier_name,
        reason: policyEvaluation.restricted_suppliers[
          `${supplier.supplier_id}_${supplier.supplier_name.replace(/ /g, "_")}`
        ]?.reason ?? "Policy restriction",
      });
      continue;
    }

    // Exclude non-preferred suppliers that have the highest risk score
    // when preferred alternatives with better risk profiles are available.
    if (
      hasPreferredAvailable &&
      !supplier.preferred_supplier &&
      supplier.risk_score === maxRiskScore
    ) {
      excluded.push({
        supplier_id: supplier.supplier_id,
        supplier_name: supplier.supplier_name,
        reason: `preferred=False, risk_score=${supplier.risk_score} (highest of eligible set). Excluded from shortlist on risk grounds.`,
      });
      continue;
    }

    candidates.push({
      supplier,
      tier,
      unitPrice,
      totalPrice,
      expeditedUnitPrice,
      expeditedTotal,
      stdLeadTime,
      expLeadTime,
    });
  }

  if (candidates.length === 0) {
    return { shortlist: [], excluded };
  }

  // Normalise price: lowest price = 1.0
  const minPrice = Math.min(...candidates.map((c) => c.totalPrice));
  const maxPrice = Math.max(...candidates.map((c) => c.totalPrice));
  const priceRange = maxPrice - minPrice || 1;

  // Normalise lead time: lowest expedited lead time = 1.0
  const minLead = Math.min(...candidates.map((c) => c.expLeadTime));
  const maxLead = Math.max(...candidates.map((c) => c.expLeadTime));
  const leadRange = maxLead - minLead || 1;

  const scored = candidates.map((c) => {
    const priceScore = 1 - (c.totalPrice - minPrice) / priceRange;
    const leadScore = 1 - (c.expLeadTime - minLead) / leadRange;
    const qualityScore = c.supplier.quality_score / 100;
    const riskScore = 1 - c.supplier.risk_score / 100;
    const esgScore = c.supplier.esg_score / 100;

    const composite =
      WEIGHTS.price * priceScore +
      WEIGHTS.lead_time * leadScore +
      WEIGHTS.quality * qualityScore +
      WEIGHTS.risk * riskScore +
      WEIGHTS.esg * esgScore;

    return {
      ...c,
      scoreBreakdown: { price: priceScore, lead_time: leadScore, quality: qualityScore, risk: riskScore, esg: esgScore },
      compositeScore: composite,
    };
  });

  scored.sort((a, b) => b.compositeScore - a.compositeScore);

  const shortlist = scored.map((c, idx) => {
    const isIncumbent = request.incumbent_supplier &&
      c.supplier.supplier_name.toLowerCase().includes(request.incumbent_supplier.toLowerCase());
    const leadTimeMet = days_until_required == null || c.expLeadTime <= days_until_required;

    let note = [];
    if (c.totalPrice === minPrice) note.push("Lowest total price");
    if (c.supplier.quality_score === Math.max(...scored.map((s) => s.supplier.quality_score)))
      note.push("Highest quality score");
    if (c.supplier.risk_score === Math.min(...scored.map((s) => s.supplier.risk_score)))
      note.push("Lowest risk score");
    if (isIncumbent) note.push("Incumbent supplier");
    if (!leadTimeMet) note.push(`Expedited lead time (${c.expLeadTime}d) does not meet the ${days_until_required}-day requirement`);

    return {
      rank: idx + 1,
      supplier_id: c.supplier.supplier_id,
      supplier_name: c.supplier.supplier_name,
      preferred: c.supplier.preferred_supplier,
      incumbent: !!isIncumbent,
      pricing_tier_applied: `${tier_label(c.tier)}`,
      unit_price: unitRound(c.unitPrice),
      total_price: unitRound(c.totalPrice),
      currency,
      standard_lead_time_days: c.stdLeadTime,
      expedited_lead_time_days: c.expLeadTime,
      expedited_unit_price: unitRound(c.expeditedUnitPrice),
      expedited_total: unitRound(c.expeditedTotal),
      quality_score: c.supplier.quality_score,
      risk_score: c.supplier.risk_score,
      esg_score: c.supplier.esg_score,
      composite_score: Math.round(c.compositeScore * 100) / 100,
      score_breakdown: roundObj(c.scoreBreakdown),
      policy_compliant: true,
      covers_delivery_country: true,
      recommendation_note: note.join(". ") || "Evaluated supplier.",
    };
  });

  return { shortlist, excluded };
}

function tier_label(tier) {
  const min = tier.min_quantity;
  const max = tier.max_quantity;
  return max > 0 ? `${min}–${max} units` : `${min}+ units`;
}

function unitRound(n) {
  return Math.round(n * 100) / 100;
}

function roundObj(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, Math.round(v * 100) / 100]));
}
