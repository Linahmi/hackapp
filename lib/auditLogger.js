/**
 * auditLogger.js
 *
 * Central audit event logger for ProcureTrace.
 *
 * - Stores events in-memory (lives for the process lifetime)
 * - Persists to data/audit_log.json using the same safe-write pattern
 *   as requestCounter.js (silent failure on Vercel read-only FS)
 * - Every event is shaped like a future DB row — migrate by inserting
 *   _memoryLog entries directly into an `audit_events` table.
 *
 * DOES NOT touch any existing pipeline files.
 */

import fs from 'fs';
import path from 'path';

// ─── Event type constants ──────────────────────────────────────────────────
// Use these strings everywhere — avoids typos and maps to future DB enum.

export const AUDIT_EVENTS = {
  // Request lifecycle
  REQUEST_RECEIVED:         'REQUEST_RECEIVED',
  REQUEST_PARSED:           'REQUEST_PARSED',
  REQUEST_HISTORY_ENRICHED: 'REQUEST_HISTORY_ENRICHED',

  // Policy & compliance
  POLICY_CHECKED:           'POLICY_CHECKED',
  POLICY_VIOLATION:         'POLICY_VIOLATION',

  // Supplier scoring
  SUPPLIERS_SCORED:         'SUPPLIERS_SCORED',
  NO_SUPPLIER_FOUND:        'NO_SUPPLIER_FOUND',
  BUNDLING_DETECTED:        'BUNDLING_DETECTED',

  // Decision
  DECISION_GENERATED:       'DECISION_GENERATED',
  AUTO_APPROVED:            'AUTO_APPROVED',
  APPROVAL_REQUIRED:        'APPROVAL_REQUIRED',
  ESCALATION_RAISED:        'ESCALATION_RAISED',

  // Notifications
  NOTIFICATION_SENT:        'NOTIFICATION_SENT',
  NOTIFICATION_FAILED:      'NOTIFICATION_FAILED',

  // Reminders
  REMINDER_SCHEDULED:       'REMINDER_SCHEDULED',
  REMINDER_SENT:            'REMINDER_SENT',
  REMINDER_CANCELLED:       'REMINDER_CANCELLED',

  // Approvals (future workflow)
  REQUEST_APPROVED:         'REQUEST_APPROVED',
  REQUEST_REJECTED:         'REQUEST_REJECTED',
  REQUEST_WITHDRAWN:        'REQUEST_WITHDRAWN',

  // Audit export
  AUDIT_EXPORTED:           'AUDIT_EXPORTED',
};

// ─── In-memory store ───────────────────────────────────────────────────────
const _memoryLog = [];

// ─── File persistence ──────────────────────────────────────────────────────
const LOG_FILE = path.join(process.cwd(), 'data', 'audit_log.json');

function safeWrite(data) {
  try {
    fs.writeFileSync(LOG_FILE, JSON.stringify(data, null, 2));
  } catch {
    // Read-only filesystem (e.g. Vercel) — skip silently
  }
}

function safeRead() {
  try {
    if (fs.existsSync(LOG_FILE)) {
      return JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8'));
    }
  } catch {
    // ignore
  }
  return [];
}

// ─── Core function ─────────────────────────────────────────────────────────

/**
 * Log one audit event.
 *
 * @param {object} params
 * @param {string} params.action     - One of AUDIT_EVENTS.* (required)
 * @param {string} params.requestId  - The R-XXXX procurement request ID (required)
 * @param {string} [params.userId]   - Actor email or role. Omit until auth is wired.
 * @param {object} [params.metadata] - Any extra context: policy ID, supplier name, etc.
 * @returns {object}                 - The saved event (same shape as a future DB row)
 *
 * @example
 * import { logAuditEvent, AUDIT_EVENTS } from '@/lib/auditLogger';
 *
 * // After parsing in process-stream/route.js:
 * logAuditEvent({
 *   action: AUDIT_EVENTS.REQUEST_PARSED,
 *   requestId: reqId,
 *   metadata: { category: enrichedRequest.category_l2, quantity: enrichedRequest.quantity },
 * });
 */
export function logAuditEvent({ action, requestId, userId = 'system', metadata = {} }) {
  const event = {
    // These fields map 1:1 to future DB columns in an `audit_events` table
    id:             `EVT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp:      new Date().toISOString(),
    action,                   // audit_events.action        (VARCHAR / enum)
    request_id:     requestId, // audit_events.request_id   (FK → requests)
    user_id:        userId,    // audit_events.user_id      (FK → users, NULL until auth)
    metadata,                  // audit_events.metadata     (JSONB in Postgres)
    schema_version: 1,         // bump this when the shape changes
  };

  _memoryLog.push(event);

  // Persist to file — keep last 2000 events
  const existing = safeRead();
  existing.push(event);
  if (existing.length > 2000) existing.splice(0, existing.length - 2000);
  safeWrite(existing);

  console.log(`[AuditLog] ${event.action} | ${requestId} | ${userId}`);
  return event;
}

// ─── Query helpers ─────────────────────────────────────────────────────────

/** All in-memory events for one request (fast, current process only) */
export function getAuditEventsForRequest(requestId) {
  return _memoryLog.filter(e => e.request_id === requestId);
}

/** All in-memory events (useful for debugging or admin dashboard) */
export function getAllAuditEvents() {
  return [..._memoryLog];
}

/**
 * Events from the persisted file — survives process restarts.
 * @param {string|null} requestId - Filter by request, or null for all
 */
export function getPersistedAuditEvents(requestId = null) {
  const all = safeRead();
  return requestId ? all.filter(e => e.request_id === requestId) : all;
}
