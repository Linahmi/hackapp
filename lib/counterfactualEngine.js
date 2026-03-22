export function generateCounterfactuals(shortlist, originalRequest) {
  if (!shortlist || shortlist.length < 2) return [];

  const winner = shortlist[0];
  const winnerScore = winner.composite_score;
  const counterfactuals = [];

  for (let i = 1; i < shortlist.length; i++) {
    const current = shortlist[i];
    const scoreDiff = winnerScore - current.composite_score;
    
    if (scoreDiff <= 0) continue;

    let required_discount_pct = (scoreDiff / 0.30) * 100;
    
    if (required_discount_pct > 0) {
       required_discount_pct = Math.round(required_discount_pct * 10) / 10;
       const required_unit_price = current.unit_price * (1 - required_discount_pct / 100);
       
       let feasibility_flag = 'low';
       if (required_discount_pct < 5) feasibility_flag = 'high';
       else if (required_discount_pct <= 15) feasibility_flag = 'medium';

       counterfactuals.push({
         supplier_id: current.supplier_id,
         supplier_name: current.supplier_name,
         required_discount_pct,
         required_unit_price: Math.max(0, Math.round(required_unit_price * 100) / 100),
         feasibility_flag,
         score_gap: Math.round(scoreDiff * 100) / 100
       });
    }
  }

  return counterfactuals;
}
