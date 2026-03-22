export function computeConcentration(category_l2, country, historical_awards) {
  if (!historical_awards || !Array.isArray(historical_awards) || historical_awards.length === 0) {
    return { risk_level: 'unknown', hhi: 0, warning: false };
  }

  let subset = historical_awards.filter(a => {
    const isAwarded = a.awarded === true || String(a.awarded).toLowerCase() === 'true';
    const matchCategory = a.category_l2 === category_l2;
    return isAwarded && matchCategory;
  });

  if (country) {
    const countrySubset = subset.filter(a => a.country === country);
    if (countrySubset.length > 0) {
      subset = countrySubset;
    }
  }

  if (subset.length === 0) {
    return { risk_level: 'unknown', hhi: 0, warning: false };
  }

  const supplierTotals = {};
  let totalMarketValue = 0;

  for (const award of subset) {
    const val = Number(award.total_value) || 0;
    const amount = val > 0 ? val : 1; 
    supplierTotals[award.supplier_id] = (supplierTotals[award.supplier_id] || 0) + amount;
    totalMarketValue += amount;
  }

  if (totalMarketValue === 0) {
    return { risk_level: 'unknown', hhi: 0, warning: false };
  }

  let hhi = 0;
  for (const supp in supplierTotals) {
    const share = (supplierTotals[supp] / totalMarketValue) * 100;
    hhi += share * share;
  }

  hhi = Math.round(hhi);
  let risk_level = 'low';
  if (hhi > 2500) risk_level = 'high';
  else if (hhi >= 1500) risk_level = 'medium';

  return {
    risk_level,
    hhi,
    warning: risk_level === 'high'
  };
}
