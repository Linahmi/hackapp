/**
 * Compute a confidence score (0–100) for the processed output.
 *
 * Deductions:
 *  - Each missing gap field: -8 pts
 *  - No eligible suppliers found: -20 pts
 *  - Budget insufficient: -15 pts
 *  - Lead time infeasible: -10 pts
 *  - Preferred supplier restricted: -10 pts
 *  - Policy conflict: -10 pts
 *  - No approval threshold found: -10 pts
 */
export function computeConfidence(request, validation, policyEvaluation, shortlist) {
  let score = 100;

  const gapCount = request.gaps?.length ?? 0;
  score -= gapCount * 8;

  if (shortlist.length === 0) score -= 20;

  for (const issue of validation.issues_detected ?? []) {
    if (issue.type === "budget_insufficient") score -= 15;
    if (issue.type === "lead_time_infeasible") score -= 10;
    if (issue.type === "policy_conflict") score -= 10;
    if (issue.type === "missing_field") { /* already counted in gapCount */ }
  }

  if (policyEvaluation.preferred_supplier?.is_restricted) score -= 10;
  if (!policyEvaluation.approval_threshold) score -= 10;

  return Math.max(0, Math.min(100, score));
}
