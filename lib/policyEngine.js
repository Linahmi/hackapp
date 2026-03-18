import { loadData } from "./dataLoader.js";

const EU_REGION = new Set([
  "AT","BE","BG","CY","CZ","DE","DK","EE","ES","FI","FR","GR","HR","HU",
  "IE","IT","LT","LU","LV","MT","NL","PL","PT","RO","SE","SI","SK","CH","UK",
]);

function inRegionScope(scopeList, countries) {
  for (const scope of scopeList) {
    if (scope === "EU" && countries.some((c) => EU_REGION.has(c))) return true;
    if (scope === "CH" && countries.includes("CH")) return true;
    if (scope === "US" && countries.includes("US")) return true;
    if (scope === "all") return true;
    if (countries.includes(scope)) return true;
  }
  return false;
}

/**
 * Evaluate procurement policies for a request.
 * Returns { approval_threshold, preferred_supplier, restricted_suppliers, category_rules_applied, geography_rules_applied }
 */
export function evaluatePolicy(request, eligibleSuppliers) {
  const { policies } = loadData();
  const {
    budget_amount,
    currency = "EUR",
    quantity,
    category_l1,
    category_l2,
    delivery_countries = [],
    preferred_supplier_mentioned,
    data_residency_constraint = false,
  } = request;

  // Determine the effective contract value (use minimum possible if budget is insufficient)
  let contractValue = budget_amount;
  if (eligibleSuppliers.length > 0 && quantity != null) {
    const minTotal = Math.min(...eligibleSuppliers.map((e) => Number(e.tier.unit_price) * quantity));
    if (contractValue == null || minTotal > contractValue) {
      contractValue = minTotal;
    }
  }

  // --- Approval threshold ---
  const thresholds = policies.approval_thresholds.filter((t) => t.currency === currency);
  const threshold = thresholds.find((t) => {
    const min = t.min_amount ?? t.min_value ?? 0;
    const max = t.max_amount ?? t.max_value ?? Infinity;
    return contractValue >= min && contractValue <= max;
  }) ?? thresholds[thresholds.length - 1];

  const approval_threshold = threshold
    ? {
        rule_applied: threshold.threshold_id,
        basis: `Contract value ${currency} ${contractValue?.toFixed(2) ?? "unknown"} falls in threshold ${threshold.threshold_id}.`,
        quotes_required: threshold.min_supplier_quotes ?? threshold.quotes_required ?? 1,
        approvers: threshold.managed_by ?? threshold.approvers ?? [],
        deviation_approval: (threshold.deviation_approval_required_from ?? []).join(", ") || null,
      }
    : null;

  // --- Preferred supplier check ---
  let preferred_supplier = null;
  if (preferred_supplier_mentioned) {
    const prefEntry = policies.preferred_suppliers.find(
      (p) =>
        p.category_l1 === category_l1 &&
        p.category_l2 === category_l2 &&
        p.supplier_name?.toLowerCase() === preferred_supplier_mentioned.toLowerCase() &&
        inRegionScope(p.region_scope ?? [], delivery_countries)
    );
    const isPreferred = !!prefEntry;

    // Check restricted status
    const restrictedEntry = policies.restricted_suppliers.find(
      (r) =>
        r.supplier_name?.toLowerCase() === preferred_supplier_mentioned.toLowerCase() &&
        r.category_l1 === category_l1 &&
        r.category_l2 === category_l2 &&
        inRegionScope(r.restriction_scope ?? [], delivery_countries)
    );
    const isRestricted = !!restrictedEntry;

    preferred_supplier = {
      supplier: preferred_supplier_mentioned,
      is_preferred: isPreferred,
      is_restricted: isRestricted,
      covers_delivery_country: eligibleSuppliers.some(
        (e) => e.supplier.supplier_name.toLowerCase() === preferred_supplier_mentioned.toLowerCase()
      ),
      policy_note: isRestricted
        ? restrictedEntry.restriction_reason
        : isPreferred
        ? prefEntry.policy_note
        : "Supplier is not on the preferred list for this category and region.",
    };
  }

  // --- Restricted suppliers in shortlist ---
  const restricted_suppliers = {};
  for (const e of eligibleSuppliers) {
    const entry = policies.restricted_suppliers.find(
      (r) =>
        r.supplier_id === e.supplier.supplier_id &&
        r.category_l1 === category_l1 &&
        r.category_l2 === category_l2 &&
        inRegionScope(r.restriction_scope ?? [], delivery_countries)
    );
    if (entry) {
      restricted_suppliers[`${e.supplier.supplier_id}_${e.supplier.supplier_name.replace(/ /g, "_")}`] = {
        restricted: true,
        reason: entry.restriction_reason,
      };
    }
  }

  // --- Category rules ---
  const category_rules_applied = policies.category_rules
    .filter((r) => r.category_l1 === category_l1 && r.category_l2 === category_l2)
    .map((r) => ({ rule_id: r.rule_id, rule_type: r.rule_type, rule_text: r.rule_text }));

  // Add data-residency category rule if applicable
  if (data_residency_constraint) {
    const residencyRule = policies.category_rules.find((r) => r.rule_type === "residency_check");
    if (residencyRule && !category_rules_applied.find((r) => r.rule_id === residencyRule.rule_id)) {
      category_rules_applied.push({
        rule_id: residencyRule.rule_id,
        rule_type: residencyRule.rule_type,
        rule_text: residencyRule.rule_text,
      });
    }
  }

  // --- Geography rules ---
  const geography_rules_applied = policies.geography_rules
    .filter((r) => {
      if (r.country) return delivery_countries.includes(r.country);
      if (r.countries) return delivery_countries.some((c) => r.countries.includes(c));
      return false;
    })
    .map((r) => ({ rule_id: r.rule_id, rule_type: r.rule_type ?? r.rule, rule_text: r.rule_text ?? r.rule }));

  return {
    approval_threshold,
    preferred_supplier,
    restricted_suppliers,
    category_rules_applied,
    geography_rules_applied,
  };
}
