import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const VALID_STATUSES = ['SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED']

// POST /api/db/requests — upsert a request into the database
export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Validate minimal shape
    if (!body.id || typeof body.id !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid "id" field' },
        { status: 400 }
      )
    }
    if (!body.raw_text || typeof body.raw_text !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid "raw_text" field' },
        { status: 400 }
      )
    }

    // Validate optional fields
    if (body.status && !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }
    if (body.quantity !== undefined && body.quantity !== null && typeof body.quantity !== 'number') {
      return NextResponse.json(
        { success: false, error: 'quantity must be a number if present' },
        { status: 400 }
      )
    }
    if (body.budget_amount !== undefined && body.budget_amount !== null && typeof body.budget_amount !== 'number') {
      return NextResponse.json(
        { success: false, error: 'budget_amount must be a number if present' },
        { status: 400 }
      )
    }
    if (body.countries !== undefined && body.countries !== null) {
      if (!Array.isArray(body.countries) || !body.countries.every((c: unknown) => typeof c === 'string')) {
        return NextResponse.json(
          { success: false, error: 'countries must be an array of strings if present' },
          { status: 400 }
        )
      }
    }

    const data = {
      raw_text: body.raw_text,
      requester_id: body.requester_id || null,
      status: body.status || 'SUBMITTED',
      category_l1: body.category_l1 || null,
      category_l2: body.category_l2 || null,
      quantity: body.quantity ?? null,
      budget_amount: body.budget_amount ?? null,
      currency: body.currency || null,
      countries: body.countries || [],
      pipeline_result: body.pipeline_result || null,
    }

    const request = await prisma.request.upsert({
      where: { id: body.id },
      update: data,
      create: {
        id: body.id,
        ...data,
      },
    })

    return NextResponse.json({ success: true, id: request.id })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error'
    console.error('[DB] POST /api/db/requests failed:', message)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// GET /api/db/requests — return latest 100 requests (default)
// GET /api/db/requests?userId=xxx — return user-specific requests (transformed)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    // MODE 1 — default: no userId, return raw DB objects (unchanged behavior)
    if (!userId) {
      const requests = await prisma.request.findMany({
        take: 100,
        orderBy: { created_at: 'desc' },
        include: { decision: true },
      })
      return NextResponse.json(requests)
    }

    // MODE 2 — user filter: return transformed { total, items }
    const requests = await prisma.request.findMany({
      where: { requester_id: userId },
      orderBy: { created_at: 'desc' },
      include: { decision: true },
    })

    const items = requests.map((r: any) => {
      const pipeline = r.pipeline_result as Record<string, any> | null
      return {
        request_id: r.id,
        category: r.category_l2 ?? r.category_l1 ?? null,
        quantity: r.quantity,
        budget: r.budget_amount,
        submitted_at: r.created_at,
        ai_status: pipeline?.recommendation?.status ?? null,
        approval_status: r.decision?.status ?? r.status ?? 'PROCESSING',
        decided_by: r.decision?.approver_id ?? null,
        decided_at: r.decision?.decided_at ?? null,
        comment: r.decision?.notes ?? null,
      }
    })

    return NextResponse.json({ total: items.length, items })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error'
    console.error('[DB] GET /api/db/requests failed:', message)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
