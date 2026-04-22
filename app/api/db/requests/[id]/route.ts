import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const VALID_STATUSES = ['SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED']

// GET /api/db/requests/[id] — return one request by id
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const request = await prisma.request.findUnique({
      where: { id },
      include: {
        decision: true,
      },
    })

    if (!request) {
      return NextResponse.json(
        { success: false, error: 'Request not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(request)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error'
    console.error('[DB] GET /api/db/requests/[id] failed:', message)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// PATCH /api/db/requests/[id] — update status, optionally create Decision
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()

    // Validate status
    if (!body.status || !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { success: false, error: `status is required and must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }

    // Check request exists
    const existing = await prisma.request.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Request not found' },
        { status: 404 }
      )
    }

    // Use transaction for atomicity when creating/updating decision
    const needsDecision = body.status === 'APPROVED' || body.status === 'REJECTED'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updated = await prisma.$transaction(async (tx: any) => {
      const updatedRequest = await tx.request.update({
        where: { id },
        data: { status: body.status },
      })

      if (needsDecision) {
        await tx.decision.upsert({
          where: { request_id: id },
          update: {
            status: body.status,
            approver_id: body.approver_id || null,
            notes: body.notes || null,
            decided_at: new Date(),
          },
          create: {
            request_id: id,
            status: body.status,
            approver_id: body.approver_id || null,
            notes: body.notes || null,
          },
        })
      }

      return tx.request.findUnique({
        where: { id },
        include: { decision: true },
      })
    })

    return NextResponse.json(updated)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error'
    console.error('[DB] PATCH /api/db/requests/[id] failed:', message)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
