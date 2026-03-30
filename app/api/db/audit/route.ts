import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /api/db/audit — insert an audit log event
// Accepts the EXACT event shape from lib/auditLogger.js:
// { id, timestamp, action, request_id, user_id, metadata, schema_version }
//
// MUST NEVER throw in a way that crashes the pipeline.
// On failure: returns { success: false, error: "..." } with status 200.
export async function POST(req: Request) {
  try {
    const event = await req.json()

    // Validate minimal shape
    if (!event.id || !event.action) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: id, action' },
        { status: 200 } // 200 — never crash pipeline
      )
    }

    await prisma.auditLog.create({
      data: {
        id: event.id,
        timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
        action: event.action,
        request_id: event.request_id || null,
        user_id: null, // user_id from auditLogger is a string like 'system', not a UUID FK — store in metadata
        metadata: {
          ...(event.metadata || {}),
          original_user_id: event.user_id || null,
        },
        schema_version: event.schema_version != null ? Number(event.schema_version) : null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    // NEVER throw — return structured error with status 200
    const message = error instanceof Error ? error.message : 'Unknown database error'
    console.error('[DB] POST /api/db/audit failed:', message)
    return NextResponse.json(
      { success: false, error: message },
      { status: 200 }
    )
  }
}
