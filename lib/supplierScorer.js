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

  const hasPreferredAvailable = eligibleSuppliers.some(
    ({ supplier }) => !restrictedIds.has(supplier.supplier_id) && supplier.preferred_supplier
  );
  
  // Safely default maxRiskScore if valid array length
  const validRisks = eligibleSuppliers.map(({ supplier }) => supplier.risk_score).filter(s => typeof s === 'number' && !isNaN(s));
  const maxRiskScore = validRisks.length > 0 ? Math.max(...validRisks) : -1;

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

    if (
      hasPreferredAvailable &&
      !supplier.preferred_supplier &&
      supplier.risk_score === maxRiskScore && maxRiskScore !== -1
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

  const minPrice = Math.min(...candidates.map((c) => c.totalPrice));
  const maxPrice = Math.max(...candidates.map((c) => c.totalPrice));
  const priceRange = maxPrice - minPrice || 1;

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

  const budget_amount = request.budget_amount ?? null;

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

    // ── TCO Calculation ────────────────────────────────────────────────────
    const baseCost = c.totalPrice;

    // Reliability multiplier (service/reliability buffer based on lead time)
    const reliabilityMultiplier = c.stdLeadTime > 25 ? 0.08 : c.stdLeadTime > 15 ? 0.05 : 0.03;
    const reliabilityCost = unitRound(baseCost * reliabilityMultiplier);

    // Lead time risk cost
    let leadTimeRiskCost = 0;
    if (days_until_required != null && c.stdLeadTime > days_until_required) {
      // expedited delivery is plausibly needed
      if (c.expeditedUnitPrice && !isNaN(c.expeditedUnitPrice) && c.expeditedUnitPrice > 0) {
        leadTimeRiskCost = unitRound((c.expeditedUnitPrice - c.unitPrice) * (quantity ?? 1) * 0.3);
      }
    }

    // Risk premium
    const supplierRiskScore = typeof c.supplier.risk_score === "number" ? c.supplier.risk_score : 0;
    const riskPremium = unitRound(baseCost * (supplierRiskScore / 100) * 0.05);

    const tco = unitRound(baseCost + reliabilityCost + leadTimeRiskCost + riskPremium);

    const tcoBreakdown = {
      base_cost: unitRound(baseCost),
      reliability_cost: reliabilityCost,
      lead_time_risk: leadTimeRiskCost,
      risk_premium: riskPremium,
    };

    const tcoNote = `TCO includes base cost (${currency} ${unitRound(baseCost).toLocaleString()}), `
      + `reliability buffer ${(reliabilityMultiplier * 100).toFixed(0)}% (${currency} ${reliabilityCost.toLocaleString()}), `
      + `lead-time risk (${currency} ${leadTimeRiskCost.toLocaleString()}), `
      + `risk premium (${currency} ${riskPremium.toLocaleString()}).`;

    const tcoVsBudgetPct = budget_amount && budget_amount > 0
      ? unitRound(((budget_amount - tco) / budget_amount) * 100)
      : null;
    // ── End TCO ────────────────────────────────────────────────────────────

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
      tco,
      tco_breakdown: tcoBreakdown,
      tco_note: tcoNote,
      tco_vs_budget_pct: tcoVsBudgetPct,
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
