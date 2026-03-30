import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/db/audit/[requestId] — return all audit logs for a given request_id
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params

    const logs = await prisma.auditLog.findMany({
      where: { request_id: requestId },
      orderBy: { timestamp: 'asc' },
    })

    return NextResponse.json(logs)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error'
    console.error('[DB] GET /api/db/audit/[requestId] failed:', message)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
