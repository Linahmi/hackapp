import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const total    = await prisma.request.count();
    const approved = await prisma.request.count({
      where: { status: { in: ['APPROVED', 'PENDING_APPROVAL'] } },
    });
    const autoApprovedPct = total > 0 ? Math.round((approved / total) * 100) : 0;
    return NextResponse.json({ total, autoApprovedPct });
  } catch {
    return NextResponse.json({ total: 0, autoApprovedPct: 0 });
  }
}
