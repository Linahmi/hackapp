// EUR conversion rates (approximate, fixed for analytics)
const FX = { EUR: 1, CHF: 1.04, USD: 0.93, GBP: 1.17 };

function toEUR(amount, currency) {
  return (amount || 0) * (FX[currency] || 1);
}

export function computeKPIs(requests, historicalAwards, processedLog) {
  const validRequests = requests.filter(r => r.budget_amount > 0);
  const totalSpend = validRequests.reduce((s, r) => s + toEUR(r.budget_amount, r.currency), 0);
  const avgValue = validRequests.length > 0 ? totalSpend / validRequests.length : 0;

  const countries = [...new Set(requests.flatMap(r => r.delivery_countries || []))];
  const businessUnits = [...new Set(requests.map(r => r.business_unit).filter(Boolean))];

  const historicalTotal = historicalAwards.reduce((s, a) => s + (parseFloat(a.total_value) || 0), 0);

  const byL1 = {};
  requests.forEach(r => {
    if (r.category_l1) byL1[r.category_l1] = (byL1[r.category_l1] || 0) + 1;
  });
  const topL1 = Object.entries(byL1).sort((a, b) => b[1] - a[1])[0];

  const processedRequests = processedLog.requests || [];
  const recommended = processedRequests.filter(r => r.status === 'recommended' || r.status === 'approved').length;
  const pipelineTotal = processedLog.counter || processedRequests.length;
  const successRate = pipelineTotal > 0 ? Math.round((recommended / pipelineTotal) * 100) : 0;

  // Savings: estimate 3% avg from bundling across historical contract value
  const estimatedSavings = Math.round(historicalTotal * 0.031);

  return {
    totalRequests: requests.length,
    totalSpendEUR: Math.round(totalSpend),
    avgRequestValueEUR: Math.round(avgValue),
    countriesCovered: countries.length,
    businessUnits: businessUnits.length,
    historicalContractValue: Math.round(historicalTotal),
    historicalAwardCount: historicalAwards.length,
    topCategory: topL1?.[0] || 'IT',
    topCategoryCount: topL1?.[1] || 0,
    topCategoryPct: Math.round(((topL1?.[1] || 0) / requests.length) * 100),
    pipelineProcessed: pipelineTotal,
    successRate,
    estimatedSavings,
  };
}

export function groupByL1(requests) {
  const groups = {};
  requests.forEach(r => {
    if (!r.category_l1) return;
    if (!groups[r.category_l1]) groups[r.category_l1] = { name: r.category_l1, count: 0, budget: 0 };
    groups[r.category_l1].count++;
    groups[r.category_l1].budget += toEUR(r.budget_amount, r.currency);
  });
  return Object.values(groups)
    .map(g => ({ ...g, budget: Math.round(g.budget) }))
    .sort((a, b) => b.count - a.count);
}

export function groupByL2(requests, limit = 8) {
  const groups = {};
  requests.forEach(r => {
    if (!r.category_l2) return;
    if (!groups[r.category_l2]) groups[r.category_l2] = { name: r.category_l2, l1: r.category_l1, count: 0, budget: 0 };
    groups[r.category_l2].count++;
    groups[r.category_l2].budget += toEUR(r.budget_amount, r.currency);
  });
  const sorted = Object.values(groups)
    .map(g => ({ ...g, budget: Math.round(g.budget) }))
    .sort((a, b) => b.count - a.count);
  if (sorted.length <= limit) return sorted;
  const top = sorted.slice(0, limit);
  const otherCount = sorted.slice(limit).reduce((s, g) => s + g.count, 0);
  const otherBudget = sorted.slice(limit).reduce((s, g) => s + g.budget, 0);
  return [...top, { name: 'Other', l1: null, count: otherCount, budget: Math.round(otherBudget) }];
}

export function groupByMonth(requests) {
  const months = {};
  requests.forEach(r => {
    const date = r.created_at || r.timestamp;
    if (!date) return;
    const key = date.slice(0, 7);
    if (!months[key]) months[key] = { key, count: 0, budget: 0 };
    months[key].count++;
    months[key].budget += toEUR(r.budget_amount, r.currency);
  });
  return Object.values(months)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(m => ({
      month: new Date(m.key + '-15').toLocaleString('en-US', { month: 'short', year: '2-digit' }),
      count: m.count,
      budget: Math.round(m.budget / 1_000_000 * 10) / 10, // millions
    }));
}

export function groupByScenario(requests) {
  const tags = {};
  requests.forEach(r => {
    (r.scenario_tags || []).forEach(t => {
      tags[t] = (tags[t] || 0) + 1;
    });
  });
  return Object.entries(tags)
    .sort(([, a], [, b]) => b - a)
    .map(([tag, count]) => ({
      tag: tag.replace(/_/g, ' '),
      count,
      pct: Math.round((count / requests.length) * 100),
    }));
}

export function groupByBusinessUnit(requests) {
  const units = {};
  requests.forEach(r => {
    if (!r.business_unit) return;
    if (!units[r.business_unit]) units[r.business_unit] = { name: r.business_unit, count: 0, budget: 0 };
    units[r.business_unit].count++;
    units[r.business_unit].budget += toEUR(r.budget_amount, r.currency);
  });
  return Object.values(units)
    .map(u => ({ ...u, budget: Math.round(u.budget) }))
    .sort((a, b) => b.budget - a.budget)
    .slice(0, 6);
}

export function getRecentProcessed(processedLog, limit = 8) {
  return (processedLog.requests || [])
    .slice()
    .reverse()
    .slice(0, limit)
    .map(r => ({
      id: r.id,
      timestamp: r.timestamp,
      category: r.category || 'Unknown',
      quantity: r.quantity,
      budget: r.budget,
      status: r.status || 'unknown',
    }));
}
