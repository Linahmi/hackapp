export const AUDIT_EVENTS = {
  REQUEST_RECEIVED:         'REQUEST_RECEIVED',
  REQUEST_PARSED:           'REQUEST_PARSED',
  REQUEST_HISTORY_ENRICHED: 'REQUEST_HISTORY_ENRICHED',
  POLICY_CHECKED:           'POLICY_CHECKED',
  POLICY_VIOLATION:         'POLICY_VIOLATION',
  SUPPLIERS_SCORED:         'SUPPLIERS_SCORED',
  NO_SUPPLIER_FOUND:        'NO_SUPPLIER_FOUND',
  BUNDLING_DETECTED:        'BUNDLING_DETECTED',
  DECISION_GENERATED:       'DECISION_GENERATED',
  AUTO_APPROVED:            'AUTO_APPROVED',
  APPROVAL_REQUIRED:        'APPROVAL_REQUIRED',
  ESCALATION_RAISED:        'ESCALATION_RAISED',
  NOTIFICATION_SENT:        'NOTIFICATION_SENT',
  NOTIFICATION_FAILED:      'NOTIFICATION_FAILED',
  REMINDER_SCHEDULED:       'REMINDER_SCHEDULED',
  REMINDER_SENT:            'REMINDER_SENT',
  REMINDER_CANCELLED:       'REMINDER_CANCELLED',
  REQUEST_APPROVED:         'REQUEST_APPROVED',
  REQUEST_REJECTED:         'REQUEST_REJECTED',
  REQUEST_WITHDRAWN:        'REQUEST_WITHDRAWN',
  AUDIT_EXPORTED:           'AUDIT_EXPORTED',
};

// In-memory log for within-invocation fast access
const _memoryLog = [];

export function logAuditEvent({ action, requestId, userId = null, metadata = {} }) {
  const event = {
    id:             `EVT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp:      new Date().toISOString(),
    action,
    request_id:     requestId,
    user_id:        userId,
    metadata,
    schema_version: 1,
  };

  _memoryLog.push(event);

  // Fire-and-forget Prisma write
  import('@/lib/prisma').then(({ prisma }) =>
    prisma.auditLog.create({
      data: {
        id:             event.id,
        timestamp:      new Date(event.timestamp),
        action:         event.action,
        request_id:     event.request_id,
        user_id:        (event.user_id && event.user_id !== 'system') ? event.user_id : null,
        metadata:       event.metadata ?? {},
        schema_version: event.schema_version,
      },
    }).catch(e => console.warn('[AuditLog] DB write failed:', e?.message))
  ).catch(e => console.warn('[AuditLog] Prisma import failed:', e?.message));

  console.log(`[AuditLog] ${event.action} | ${requestId} | ${userId}`);
  return event;
}

/** In-memory events for one request (current process only) */
export function getAuditEventsForRequest(requestId) {
  return _memoryLog.filter(e => e.request_id === requestId);
}

/** All in-memory events */
export function getAllAuditEvents() {
  return [..._memoryLog];
}

/**
 * Events from DB — survives process restarts.
 * @param {string|null} requestId - filter by request, or null for all
 */
export async function getPersistedAuditEvents(requestId = null) {
  try {
    const { prisma } = await import('@/lib/prisma');
    const rows = await prisma.auditLog.findMany({
      where:   requestId ? { request_id: requestId } : undefined,
      orderBy: { timestamp: 'asc' },
      take:    2000,
    });
    return rows.map(r => ({
      id:             r.id,
      timestamp:      r.timestamp.toISOString(),
      action:         r.action,
      request_id:     r.request_id,
      user_id:        r.user_id,
      metadata:       r.metadata ?? {},
      schema_version: r.schema_version ?? 1,
    }));
  } catch (e) {
    console.warn('[AuditLog] DB read failed:', e?.message);
    return [];
  }
}

/**
 * Bulk-flush in-memory audit events for a request to the DB.
 * Call this at the end of a pipeline run before sending the result.
 */
export async function flushAuditEventsToDB(requestId) {
  const events = _memoryLog.filter(e => e.request_id === requestId);
  if (events.length === 0) return;
  try {
    const { prisma } = await import('@/lib/prisma');
    await prisma.auditLog.createMany({
      data: events.map(e => ({
        id:             e.id,
        timestamp:      new Date(e.timestamp),
        action:         e.action,
        request_id:     e.request_id,
        user_id:        (e.user_id && e.user_id !== 'system') ? e.user_id : null,
        metadata:       e.metadata ?? {},
        schema_version: e.schema_version,
      })),
      skipDuplicates: true,
    });
  } catch (e) {
    console.warn('[AuditLog] Bulk flush failed:', e?.message);
  }
}
