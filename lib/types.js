// lib/types.js
// 🚨 THE CONTRACT — everyone reads this, nobody edits it alone

export const MOCK_RESPONSE = {
  request_id: "REQ-000004",
  processed_at: "",
  confidence_score: 72,

  request_interpretation: {
    category_l1: "IT",
    category_l2: "Docking Stations",
    quantity: 240,
    budget_amount: 25199.55,
    currency: "EUR",
    delivery_countries: ["DE"],
    required_by_date: "2026-03-20",
    days_until_required: 6,
    preferred_supplier_stated: "Dell Enterprise Europe",
    gaps: [],
    detected_language: "en"
  },

  validation: {
    completeness: "fail",
    issues: [
      {
        id: "V-001",
        severity: "critical",
        type: "budget_insufficient",
        description: "Budget too low for requested quantity",
        action: "Increase budget or reduce quantity"
      }
    ]
  },

  policy_evaluation: {
    approval_tier: {
      tier: 2,
      quotes_required: 2,
      approver: "Procurement Manager"
    },
    preferred_supplier: {
      name: "Dell",
      is_preferred: true,
      is_restricted: false,
      covers_delivery_country: true
    },
    violations: []
  },

  supplier_shortlist: [
    {
      rank: 1,
      supplier_id: "SUP-0007",
      supplier_name: "Bechtle",
      preferred: true,
      incumbent: true,

      unit_price: 148.80,
      total_price: 35712.00,

      standard_lead_time_days: 26,
      expedited_lead_time_days: 18,

      quality_score: 82,
      risk_score: 19,
      esg_score: 72,

      composite_score: 0.74,

      score_breakdown: {
        price: 0.90,
        lead_time: 0.60,
        quality: 0.82,
        risk: 0.81,
        esg: 0.72
      },

      policy_compliant: true,
      recommendation_note: "Best balance between price, risk, and ESG"
    }
  ],

  escalations: [
    {
      id: "ESC-001",
      rule: "ER-001",
      trigger: "Budget insufficient",
      escalate_to: "Requester",
      blocking: true
    }
  ],

  recommendation: {
    status: "cannot_proceed",
    reason: "Budget insufficient",
    preferred_supplier_if_resolved: "Bechtle Workplace Solutions",
    rationale: "Best overall supplier if constraints resolved"
  },

  bundling_opportunity: null,

  audit_trail: {
    policies_checked: ["AT-002", "ER-001"],
    suppliers_evaluated: ["SUP-0001", "SUP-0007"],
    data_sources_used: [
      "requests.json",
      "suppliers.csv",
      "pricing.csv",
      "policies.json"
    ],
    historical_awards_consulted: true
  },
  steps: [
    { id: "parsing", label: "Reading request", status: "done" },
    { id: "validation", label: "Checking completeness", status: "done" },
    { id: "policy", label: "Applying rules", status: "running" },
    { id: "scoring", label: "Scoring suppliers", status: "pending" },
    { id: "decision", label: "Generating decision", status: "pending" }
  ],
};