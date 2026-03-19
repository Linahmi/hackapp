// lib/historicalLookup.js
import { getData } from './dataLoader.js';

export function findHistoricalContext(categoryL2, deliveryCountries, businessUnit) {
  try {
    const data = getData();
    const historicalAwards = data.historicalAwards || [];
    
    let matchLevel = 'none';

    // 1. Try Business Unit + Category + Country matching (all records, awarded AND rejected)
    let matches = historicalAwards.filter(record => {
      if (record.category_l2 !== categoryL2) return false;
      if (!deliveryCountries.includes(record.country)) return false;
      if (businessUnit && record.business_unit === businessUnit) return true;
      return false;
    });

    if (matches.length > 0) {
      matchLevel = 'business_unit';
    } else {
      // 2. Fallback to Category + Country matching only
      matches = historicalAwards.filter(record => {
        if (record.category_l2 !== categoryL2) return false;
        if (!deliveryCountries.includes(record.country)) return false;
        return true;
      });
      if (matches.length > 0) {
        matchLevel = 'category_only';
      }
    }

    matches.sort((a, b) => new Date(b.award_date) - new Date(a.award_date));

    return {
      match_level: matchLevel,
      records: matches.map(m => ({
        award_id: m.award_id,
        supplier_id: m.supplier_id,
        supplier_name: m.supplier_name,
        total_value: parseFloat(m.total_value),
        savings_pct: m.savings_pct ? parseFloat(m.savings_pct) : 0,
        lead_time_days: m.lead_time_days ? parseInt(m.lead_time_days) : 0,
        decision_rationale: m.decision_rationale,
        awarded: m.awarded === 'True' || m.awarded === 'true' || m.awarded === true,
        award_date: m.award_date,
        escalation_required: m.escalation_required === 'True' || m.escalation_required === 'true' || m.escalation_required === true,
        escalated_to: m.escalated_to || null,
        business_unit: m.business_unit
      }))
    };
  } catch (error) {
    return { match_level: 'none', records: [] };
  }
}
