import { NextResponse } from 'next/server';
import { getData } from '../../../lib/dataLoader';

export async function GET() {
  const data = getData();
  const requests = data.requests || [];
  
  const result = requests.map(r => ({
    request_id: r.request_id,
    title: r.title,
    country: r.country,
    category_l2: r.category_l2,
    budget_amount: r.budget_amount !== null ? parseFloat(r.budget_amount) : null,
    currency: r.currency,
    scenario_tags: r.scenario_tags || [],
    request_language: r.request_language
  }));
  
  return NextResponse.json(result);
}
