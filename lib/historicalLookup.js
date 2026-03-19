// lib/historicalLookup.js
import { getData } from './dataLoader.js';

export function findHistoricalContext(categoryL2, deliveryCountries) {
  try {
    const data = getData();
    const historicalAwards = data.historicalAwards || [];

    let matches = historicalAwards.filter(record => {
      if (record.category_l2 !== categoryL2) return false;
      const isAwarded = record.awarded === 'True' || record.awarded === 'true' || record.awarded === true;
      if (!isAwarded) return false;
      if (!deliveryCountries.includes(record.country)) return false;
      return true;
    });

    matches.sort((a, b) => new Date(b.award_date) - new Date(a.award_date));
    
    // Take exactly the top 3
    matches = matches.slice(0, 3);

    return matches.map(m => ({
      award_id: m.award_id,
      supplier_name: m.supplier_name,
      total_value: parseFloat(m.total_value),
      savings_pct: m.savings_pct ? parseFloat(m.savings_pct) : 0,
      lead_time_days: m.lead_time_days ? parseInt(m.lead_time_days) : 0,
      decision_rationale: m.decision_rationale,
      escalation_required: m.escalation_required === 'True' || m.escalation_required === 'true' || m.escalation_required === true,
      escalated_to: m.escalated_to || null
    }));
  } catch (error) {
    return [];
  }
}
