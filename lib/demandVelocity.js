export function calculateDemandVelocity(category_l2, allRequests) {
  if (!allRequests || allRequests.length === 0) return { ratio: 1, signal: "Stable", trigger: null };

  const validDates = allRequests
    .map(r => r.created_at ? new Date(r.created_at).getTime() : null)
    .filter(t => t !== null && !isNaN(t));

  if (validDates.length === 0) return { ratio: 1, signal: "Stable", trigger: null };

  const todayTime = Math.max(...validDates);
  const DAY_MS = 24 * 60 * 60 * 1000;
  const cutoff45 = todayTime - 45 * DAY_MS;
  const cutoff90 = todayTime - 90 * DAY_MS;

  let recent_count = 0;
  let prior_count = 0;

  for (const req of allRequests) {
    if (req.category_l2 === category_l2 && req.created_at) {
      const t = new Date(req.created_at).getTime();
      if (t > cutoff45 && t <= todayTime) recent_count++;
      else if (t > cutoff90 && t <= cutoff45) prior_count++;
    }
  }

  const safe_prior = prior_count === 0 ? 1 : prior_count;
  const rawRatio = recent_count / safe_prior;
  const ratio = Math.round(rawRatio * 100) / 100;

  let signal = "Stable";
  let trigger = null;

  if (ratio > 1.5 && recent_count >= 3) {
    signal = "Surge";
    trigger = `Demand for ${category_l2 || 'category'} is surging (${ratio}x vs prior 45 days). Consider proactive framework negotiation.`;
  } else if (ratio < 0.7 && prior_count >= 3) {
    signal = "Cooling";
  }

  return {
    ratio,
    signal,
    trigger,
    recent_count,
    prior_count
  };
}
