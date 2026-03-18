// lib/confidenceScorer.js

export function computeConfidence({ issues, suppliers, preferredAvailable, historicalMatch }) {
  let score = 100;

  if (issues && issues.length > 0) {
    for (const issue of issues) {
      if (issue.severity === 'critical') score -= 20;
      else if (issue.severity === 'high') score -= 10;
    }
  }

  if (!suppliers || suppliers.length === 0) {
    score -= 30;
  } else if (suppliers.length >= 2) {
    const diff = suppliers[0].composite_score - suppliers[1].composite_score;
    if (diff <= 0.05) {
      score -= 10;
    }
  }

  if (preferredAvailable) score += 10;
  if (historicalMatch) score += 10;

  return Math.max(0, Math.min(100, score));
}
