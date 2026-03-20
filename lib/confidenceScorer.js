function pushDriver(drivers, tone, label) {
  drivers.push({ tone, label });
}

export function explainConfidence(request, validation, policyEvaluation, shortlist, escalations = [], recommendation = null) {
  let score = 78;
  const drivers = [];

  const issues = validation?.issues ?? validation?.issues_detected ?? [];
  const gapCount = request?.gaps?.length ?? 0;
  const hasBlockingEscalation = escalations.some((e) => e.blocking);
  const hasShortlist = (shortlist?.length ?? 0) > 0;
  const topSupplier = shortlist?.[0] ?? null;

  if (hasShortlist) {
    score += 8;
    pushDriver(drivers, "good", `${shortlist.length} compliant supplier option${shortlist.length > 1 ? "s" : ""} found`);
  } else {
    score -= 18;
    pushDriver(drivers, "danger", "No compliant supplier available in the approved panel");
  }

  if (gapCount === 0) {
    score += 6;
    pushDriver(drivers, "good", "Request contains the required procurement fields");
  } else {
    score -= Math.min(18, gapCount * 6);
    pushDriver(drivers, "warn", `${gapCount} missing or weakly inferred request field${gapCount > 1 ? "s" : ""}`);
  }

  const criticalCount = issues.filter((issue) => issue.severity === "critical").length;
  const highCount = issues.filter((issue) => issue.severity === "high").length;
  if (criticalCount > 0) {
    score -= criticalCount * 10;
    pushDriver(drivers, "danger", `${criticalCount} critical validation issue${criticalCount > 1 ? "s" : ""}`);
  } else if (highCount > 0) {
    score -= highCount * 5;
    pushDriver(drivers, "warn", `${highCount} high-severity validation issue${highCount > 1 ? "s" : ""}`);
  } else {
    score += 4;
    pushDriver(drivers, "good", "No critical validation blockers detected");
  }

  if (policyEvaluation?.approval_threshold) {
    score += 3;
    pushDriver(drivers, "good", `Policy rule ${policyEvaluation.approval_threshold.rule_applied} applied`);
  } else {
    score -= 10;
    pushDriver(drivers, "danger", "Approval threshold could not be determined");
  }

  if (policyEvaluation?.preferred_supplier?.is_restricted) {
    score -= 10;
    pushDriver(drivers, "danger", "Preferred supplier conflicts with policy");
  }

  if (hasBlockingEscalation) {
    score -= 12;
    pushDriver(drivers, "warn", "Human escalation is required before award");
  } else if (recommendation?.is_auto_approved) {
    score += 5;
    pushDriver(drivers, "good", "Case is eligible for automated progression");
  }

  if (topSupplier?.historical_flags?.length) {
    score += 2;
    pushDriver(drivers, "good", "Historical award context supports the recommendation");
  }

  if (recommendation?.status === "cannot_proceed" && !hasShortlist) {
    score = Math.min(score, 72);
  }
  if (recommendation?.status === "cannot_proceed" && hasBlockingEscalation) {
    score = Math.min(score, 76);
  }
  if (recommendation?.is_auto_approved && gapCount === 0 && criticalCount === 0 && hasShortlist) {
    score = Math.min(score + 4, 92);
  }

  score = Math.max(35, Math.min(92, score));

  return {
    score,
    drivers: drivers.slice(0, 4),
  };
}

export function computeConfidence(request, validation, policyEvaluation, shortlist, escalations = [], recommendation = null) {
  return explainConfidence(request, validation, policyEvaluation, shortlist, escalations, recommendation).score;
}
