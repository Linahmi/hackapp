import { getData } from './dataLoader.js';

export function checkApprovalTier(totalValue, currency) {
  const { policies } = getData();
  const thresholds = policies.approval_thresholds
    .filter(t => t.currency === currency)
    .sort((a, b) => {
      const minA = a.min_amount !== undefined ? a.min_amount : a.min_value;
      const minB = b.min_amount !== undefined ? b.min_amount : b.min_value;
      return minA - minB;
    });

  for (let i = 0; i < thresholds.length; i++) {
    const t = thresholds[i];
    const min = t.min_amount !== undefined ? parseFloat(t.min_amount) : parseFloat(t.min_value);
    const max = t.max_amount !== undefined ? (t.max_amount === null ? Infinity : parseFloat(t.max_amount)) : (t.max_value === null ? Infinity : parseFloat(t.max_value));

    if (totalValue >= min && totalValue <= max) {
      let approver = null;
      if (t.deviation_approval_required_from?.length > 0) {
        approver = t.deviation_approval_required_from[0];
      } else if (t.approvers?.length > 0) {
        const maps = {
          "business": "Business",
          "procurement": "Procurement Manager",
          "head_of_strategic_sourcing": "Head of Strategic Sourcing",
          "cpo": "CPO"
        };
        approver = maps[t.approvers[t.approvers.length - 1]] || t.approvers[t.approvers.length - 1];
      } else if (t.managed_by?.length > 0) {
        approver = t.managed_by[0] === 'business' ? 'Business' : 'Procurement Manager';
      }

      return {
        tier: i + 1,
        quotes_required: t.min_supplier_quotes !== undefined ? parseInt(t.min_supplier_quotes) : parseInt(t.quotes_required),
        approver
      };
    }
  }
  return null;
}

export function checkPreferredSupplier(supplierName, categoryL2, deliveryCountry) {
  const { suppliers } = getData();
  const supplier = suppliers.find(s =>
    s.supplier_name === supplierName &&
    s.category_l2 === categoryL2
  );

  if (!supplier) return null;

  const regions = supplier.service_regions ? (Array.isArray(supplier.service_regions) ? supplier.service_regions : supplier.service_regions.split(';')) : [];
  const coversCountry = regions.includes(deliveryCountry);
  const isPreferred = supplier.preferred_supplier === "True" || supplier.preferred_supplier === true || supplier.preferred_supplier === "true";
  const isRestricted = supplier.is_restricted === "True" || supplier.is_restricted === true || supplier.is_restricted === "true";

  return {
    name: supplier.supplier_name,
    is_preferred: isPreferred,
    is_restricted: isRestricted,
    covers_delivery_country: coversCountry
  };
}

export function checkCategoryRules(categoryL1, categoryL2) {
  const { policies } = getData();
  if (!policies?.category_rules) return [];
  return policies.category_rules.filter(
    r => r.category_l1 === categoryL1 && r.category_l2 === categoryL2
  );
}

export function checkGeographyRules(deliveryCountries, dataResidencyRequired) {
  const { policies } = getData();
  if (!policies?.geography_rules) return [];
  const rules = [];

  for (const rule of policies.geography_rules) {
    if (rule.country && deliveryCountries.includes(rule.country)) {
      if (rule.rule_type === 'sovereign_preference' && dataResidencyRequired) {
        rules.push(rule);
      } else if (rule.rule_type !== 'sovereign_preference') {
        rules.push(rule);
      }
    } else if (rule.countries) {
      for (const c of deliveryCountries) {
        if (rule.countries.includes(c)) {
          rules.push(rule);
          break;
        }
      }
    }
  }
  return rules;
}

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
  const { policies } = getData();
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

  let contractValue = budget_amount;
  if (eligibleSuppliers.length > 0 && quantity != null) {
    const minTotal = Math.min(...eligibleSuppliers.map((e) => Number(e.tier.unit_price) * quantity));
    if (contractValue == null || minTotal > contractValue) {
      contractValue = minTotal;
    }
  }

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

  const category_rules_applied = policies.category_rules
    .filter((r) => r.category_l1 === category_l1 && r.category_l2 === category_l2)
    .map((r) => ({ rule_id: r.rule_id, rule_type: r.rule_type, rule_text: r.rule_text }));

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
