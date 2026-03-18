import { getData } from './dataLoader.js';

export function scoreSuppliers(categoryL1, categoryL2, deliveryCountries, quantity, currency) {
  const { suppliers, pricing } = getData();

  const validSuppliers = suppliers.filter(s => {
    if (s.category_l2 !== categoryL2) return false;
    const restricted = s.is_restricted === 'True' || s.is_restricted === true || s.is_restricted === 'true';
    if (restricted) return false;
    if (s.capacity_per_month && parseInt(s.capacity_per_month) < quantity) return false;
    if (!s.service_regions) return false;
    const regions = s.service_regions.split(';');
    return deliveryCountries.every(c => regions.includes(c));
  });

  const supplierData = validSuppliers.map(s => {
    const matchingPricing = pricing.find(p =>
      p.supplier_id === s.supplier_id &&
      p.category_l2 === categoryL2 &&
      quantity >= parseInt(p.min_quantity) &&
      (p.max_quantity === '999999999' || quantity <= parseInt(p.max_quantity)) &&
      p.currency === currency
    );

    if (!matchingPricing) return null;

    return {
      ...s,
      unit_price: parseFloat(matchingPricing.unit_price),
      expedited_unit_price: parseFloat(matchingPricing.expedited_unit_price),
      standard_lead_time_days: parseInt(matchingPricing.standard_lead_time_days),
      expedited_lead_time_days: parseInt(matchingPricing.expedited_lead_time_days),
      quality: parseInt(s.quality_score),
      risk: parseInt(s.risk_score),
      esg: parseInt(s.esg_score)
    };
  }).filter(Boolean);

  if (supplierData.length === 0) return [];

  const minPrice = Math.min(...supplierData.map(s => s.unit_price));
  const minLead = Math.min(...supplierData.map(s => s.standard_lead_time_days));

  const scored = supplierData.map(s => {
    const priceScore = minPrice > 0 ? minPrice / s.unit_price : 1.0;
    const leadScore = minLead > 0 ? minLead / s.standard_lead_time_days : 1.0;
    const qualityScore = s.quality / 100;
    const riskScore = 1 - (s.risk / 100);
    const esgScore = s.esg / 100;

    const composite = (priceScore * 0.35) + (leadScore * 0.25) + (qualityScore * 0.20) + (riskScore * 0.15) + (esgScore * 0.05);
    const isPreferred = s.preferred_supplier === "True" || s.preferred_supplier === true || s.preferred_supplier === "true";

    return {
      rank: 0,
      supplier_id: s.supplier_id,
      supplier_name: s.supplier_name,
      preferred: isPreferred,
      incumbent: false,
      unit_price: s.unit_price,
      total_price: parseFloat((s.unit_price * quantity).toFixed(2)),
      expedited_unit_price: s.expedited_unit_price,
      expedited_total: parseFloat((s.expedited_unit_price * quantity).toFixed(2)),
      standard_lead_time_days: s.standard_lead_time_days,
      expedited_lead_time_days: s.expedited_lead_time_days,
      quality_score: s.quality,
      risk_score: s.risk,
      esg_score: s.esg,
      composite_score: parseFloat(composite.toFixed(4)),
      score_breakdown: {
        price: parseFloat(priceScore.toFixed(2)),
        lead_time: parseFloat(leadScore.toFixed(2)),
        quality: parseFloat(qualityScore.toFixed(2)),
        risk: parseFloat(riskScore.toFixed(2)),
        esg: parseFloat(esgScore.toFixed(2))
      },
      policy_compliant: true
    };
  });

  scored.sort((a, b) => b.composite_score - a.composite_score);
  scored.forEach((s, i) => { s.rank = i + 1; });

  return scored.slice(0, 3);
}