import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const file = path.join(process.cwd(), 'data', 'request_counter.json');
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const requests = data.requests || [];
    const total = data.counter ?? requests.length;
    const approved = requests.filter(
      (r) => r.status === 'approved' || r.status === 'pending_approval'
    ).length;
    const autoApprovedPct = total > 0 ? Math.round((approved / total) * 100) : 0;
    return NextResponse.json({ total, autoApprovedPct });
  } catch {
    return NextResponse.json({ total: 0, autoApprovedPct: 0 });
  }
}
