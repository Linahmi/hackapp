/**
 * reminderService.js
 *
 * Schedules and fires approval reminders for pending procurement requests.
 *
 * Storage: in-memory Map — survives the Node.js process lifetime.
 * When DB is ready: replace _reminders with a `reminders` table query.
 *   Each entry already has the exact shape of a DB row.
 *
 * Lifecycle:
 *   1. scheduleReminder()          — called after sendApprovalEmail()
 *   2. checkPendingReminders()     — called by GET /api/reminders/check or a cron
 *   3. cancelReminder(requestId)   — called when request is approved/rejected
 */

import { logAuditEvent, AUDIT_EVENTS } from './auditLogger.js';
import { sendReminderEmail } from './notificationService.js';

// ─── In-memory store ───────────────────────────────────────────────────────
// Map<requestId, ReminderRecord>
// Replace with DB query when ready — shape is already DB-compatible.
const _reminders = new Map();

// ─── Timing constants ──────────────────────────────────────────────────────
// Override via env vars so you can test quickly without editing code.
const FIRST_REMINDER_MS  = parseInt(process.env.REMINDER_FIRST_MS  ?? String(24 * 60 * 60 * 1000), 10); // 24h
const REPEAT_REMINDER_MS = parseInt(process.env.REMINDER_REPEAT_MS ?? String(48 * 60 * 60 * 1000), 10); // 48h


// ─── scheduleReminder ──────────────────────────────────────────────────────

/**
 * Schedule a reminder for an approval that is now pending.
 * Safe to call multiple times — overwrites the previous reminder for the same requestId.
 *
 * @param {object} params
 * @param {string} params.requestId
 * @param {string} params.approverEmail    - Where to send the reminder
 * @param {string} params.approverName     - Display name for the email
 * @param {string} params.summary          - Short description of the request
 * @param {string} [params.link]           - Deep link (placeholder until routing ready)
 * @param {number} [params.delayMs]        - Override first-reminder delay
 * @returns {object}                       - The scheduled reminder record
 *
 * @example
 * // In process-stream/route.js, after sendApprovalEmail(), inside Step 5:
 * scheduleReminder({
 *   requestId:     reqId,
 *   approverEmail: 'procurement.manager@company.com',
 *   approverName:  requiredApprover,
 *   summary:       `${enrichedRequest.quantity} × ${enrichedRequest.category_l2} · ${enrichedRequest.currency} ${enrichedRequest.budget_amount?.toLocaleString()}`,
 * });
 */
export function scheduleReminder({
  requestId,
  approverEmail,
  approverName,
  summary,
  link = '#',
  delayMs = FIRST_REMINDER_MS,
}) {
  const now        = Date.now();
  const scheduledAt = new Date(now).toISOString();
  const firstDueAt  = new Date(now + delayMs).toISOString();

  // DB-ready shape: maps directly to a `reminders` table row
  const record = {
    request_id:     requestId,      // FK → requests
    approver_email: approverEmail,
    approver_name:  approverName,
    summary,
    link,
    scheduled_at:   scheduledAt,
    first_due_at:   firstDueAt,
    next_due_at:    firstDueAt,     // updated after each send
    sent_count:     0,
    last_sent_at:   null,
    status:         'pending',      // 'pending' | 'sent' | 'cancelled'
  };

  _reminders.set(requestId, record);

  logAuditEvent({
    action:    AUDIT_EVENTS.REMINDER_SCHEDULED,
    requestId,
    metadata:  { approverEmail, approverName, firstDueAt },
  });

  console.log(`[ReminderService] Scheduled for ${requestId} — first reminder at ${firstDueAt}`);
  return record;
}


// ─── checkPendingReminders ─────────────────────────────────────────────────

/**
 * Check all pending reminders and send emails for any that are now overdue.
 *
 * WHEN TO CALL — two options (pick one):
 *
 *   Option A: Expose GET /api/reminders/check and hit it from an external cron
 *             (e.g. GitHub Actions schedule, Vercel cron, uptime monitor).
 *
 *   Option B: Call it from a long-lived server process via setInterval:
 *             setInterval(checkPendingReminders, 60 * 60 * 1000); // every hour
 *
 * @returns {Promise<Array<{ requestId, status, sentCount?, error? }>>}
 *          List of reminders that were actioned in this run
 *
 * @example
 * // app/api/reminders/check/route.js  (create this file to expose the endpoint)
 * import { checkPendingReminders } from '@/lib/reminderService';
 * export async function GET() {
 *   const actioned = await checkPendingReminders();
 *   return Response.json({ actioned });
 * }
 */
export async function checkPendingReminders() {
  const now = Date.now();
  const actioned = [];

  for (const [requestId, record] of _reminders.entries()) {
    // Skip cancelled or not-yet-due
    if (record.status === 'cancelled') continue;
    if (new Date(record.next_due_at).getTime() > now) continue;

    const pendingHours = Math.round(
      (now - new Date(record.scheduled_at).getTime()) / (1000 * 60 * 60)
    );

    try {
      await sendReminderEmail({
        to:           record.approver_email,
        requestId:    record.request_id,
        approverName: record.approver_name,
        summary:      record.summary,
        pendingHours,
        link:         record.link,
      });

      // Update state in place
      record.sent_count  += 1;
      record.status       = 'sent';
      record.last_sent_at = new Date().toISOString();
      // Schedule next repeat
      record.next_due_at  = new Date(now + REPEAT_REMINDER_MS).toISOString();

      logAuditEvent({
        action:    AUDIT_EVENTS.REMINDER_SENT,
        requestId,
        metadata:  {
          approverEmail: record.approver_email,
          sentCount:     record.sent_count,
          pendingHours,
          nextDueAt:     record.next_due_at,
        },
      });

      actioned.push({ requestId, status: 'sent', sentCount: record.sent_count });
    } catch (err) {
      console.error(`[ReminderService] Failed for ${requestId}: ${err.message}`);
      actioned.push({ requestId, status: 'failed', error: err.message });
    }
  }

  if (actioned.length === 0) {
    console.log('[ReminderService] checkPendingReminders — nothing overdue');
  }

  return actioned;
}


// ─── cancelReminder ────────────────────────────────────────────────────────

/**
 * Cancel a pending reminder. Call this when a request is approved, rejected,
 * or withdrawn so the approver stops receiving emails.
 *
 * @param {string} requestId
 * @returns {boolean} true if a reminder was found and cancelled
 *
 * @example
 * // Future: in a POST /api/requests/[id]/approve handler:
 * cancelReminder(requestId);
 */
export function cancelReminder(requestId) {
  const record = _reminders.get(requestId);
  if (!record) return false;

  record.status = 'cancelled';

  logAuditEvent({
    action:    AUDIT_EVENTS.REMINDER_CANCELLED,
    requestId,
    metadata:  { approverEmail: record.approver_email },
  });

  console.log(`[ReminderService] Cancelled reminder for ${requestId}`);
  return true;
}


// ─── Inspection helpers ────────────────────────────────────────────────────

/** All reminders (useful for an admin dashboard). */
export function getAllReminders() {
  return Array.from(_reminders.values());
}

/** Reminder state for one specific request. Returns null if not found. */
export function getReminderForRequest(requestId) {
  return _reminders.get(requestId) ?? null;
}
