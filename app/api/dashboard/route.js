import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import {
  computeKPIs,
  groupByL1,
  groupByL2,
  groupByMonth,
  groupByScenario,
  groupByBusinessUnit,
  getRecentProcessed,
} from '@/lib/dashboardAnalytics';
import { calculateDemandVelocity } from '@/lib/demandVelocity';

export async function GET() {
  try {
    const dataDir = path.join(process.cwd(), 'data');

    const requests = JSON.parse(fs.readFileSync(path.join(dataDir, 'requests.json'), 'utf-8'));

    const historicalAwards = parse(
      fs.readFileSync(path.join(dataDir, 'historical_awards.csv'), 'utf-8'),
      { columns: true, skip_empty_lines: true, cast: true }
    );

    const processedLog = JSON.parse(
      fs.readFileSync(path.join(dataDir, 'request_counter.json'), 'utf-8')
    );

    const allL2s = Array.from(new Set(requests.map(r => r.category_l2).filter(Boolean)));
    const demand_velocity = [];
    const framework_triggers = [];

    allL2s.forEach(c => {
       const v = calculateDemandVelocity(c, requests);
       demand_velocity.push({ category: c, ...v });
       if (v.trigger) {
         framework_triggers.push(v.trigger);
       }
    });

    demand_velocity.sort((a, b) => b.ratio - a.ratio);

    return NextResponse.json({
      kpis: computeKPIs(requests, historicalAwards, processedLog),
      byL1: groupByL1(requests),
      byL2: groupByL2(requests, 8),
      byMonth: groupByMonth(requests),
      byScenario: groupByScenario(requests),
      byBusinessUnit: groupByBusinessUnit(requests),
      recentProcessed: getRecentProcessed(processedLog, 8),
      demand_velocity: demand_velocity.slice(0, 5),
      framework_triggers: framework_triggers,
    });
  } catch (err) {
    console.error('[dashboard]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
