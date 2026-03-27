/**
 * notificationService.js
 *
 * Sends email notifications. Three modes, zero code changes to switch:
 *
 *   MOCK   (default)  — logs to console + in-memory. No external calls.
 *   RESEND            — set RESEND_API_KEY env var. Sends real email via Resend.
 *   Other provider    — swap _sendViaProvider() body only.
 *
 * Every sent/failed notification is recorded via logAuditEvent() from auditLogger.js.
 * The logNotification() helper is also exported so other modules can record
 * notification state without calling send functions.
 */

import { logAuditEvent, AUDIT_EVENTS } from './auditLogger.js';
import {
  buildApprovalEmailTemplate,
  buildDecisionEmailTemplate,
  buildReminderEmailTemplate,
} from './emailTemplates.js';

// ─── Internal provider ─────────────────────────────────────────────────────

/**
 * Single point of contact with the email provider.
 * To change provider: replace this function body — nothing else changes.
 *
 * @param {{ to: string, subject: string, text: string, html: string }} email
 * @returns {Promise<{ success: boolean, provider: string, messageId: string }>}
 */
async function _sendViaProvider({ to, subject, text, html }) {
  const apiKey = process.env.RESEND_API_KEY;

  // ── Mode 1: MOCK — no API key configured ──────────────────────────────
  if (!apiKey) {
    console.log('[NotificationService] ── MOCK EMAIL ──────────────────────');
    console.log(`  To:      ${to}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Body:    ${text.slice(0, 140).replace(/\n/g, ' ')}…`);
    console.log('[NotificationService] ─────────────────────────────────────');
    return { success: true, provider: 'mock', messageId: `mock-${Date.now()}` };
  }

  // ── Mode 2: RESEND ─────────────────────────────────────────────────────
  // Docs: https://resend.com/docs/api-reference/emails/send
  const from = process.env.NOTIFICATION_FROM_EMAIL ?? 'ProcureTrace <noreply@procuretrace.app>';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ from, to, subject, html, text }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend API ${res.status}: ${err}`);
  }

  const data = await res.json();
  return { success: true, provider: 'resend', messageId: data.id };
}


// ─── Notification logger ───────────────────────────────────────────────────

/**
 * Record a notification attempt in the audit trail.
 * Uses logAuditEvent under the hood — compatible with the same DB table.
 *
 * @param {object} params
 * @param {string} params.type       - 'approval_request' | 'decision_result' | 'reminder'
 * @param {string} params.to         - Recipient email
 * @param {string} params.requestId
 * @param {string} params.status     - 'sent' | 'failed'
 * @param {object} [params.metadata] - Any extra context
 * @returns {object}                 - The audit event
 *
 * @example
 * // Manually record a notification outside of send functions:
 * logNotification({ type: 'approval_request', to: 'mgr@co.com', requestId: 'R-0042', status: 'sent' });
 */
export function logNotification({ type, to, requestId, status, metadata = {} }) {
  return logAuditEvent({
    action:   status === 'sent' ? AUDIT_EVENTS.NOTIFICATION_SENT : AUDIT_EVENTS.NOTIFICATION_FAILED,
    requestId,
    userId:   'system',
    metadata: { notification_type: type, to, status, ...metadata },
  });
}


// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Send an approval-request email to the required approver.
 *
 * WHEN TO CALL: After the pipeline determines requiredApprover (Step 5: logged).
 * WHERE IN process-stream/route.js: after the isAutoApproved / requiredApprover block,
 * when isAutoApproved === false.
 *
 * @param {object} params
 * @param {string} params.to             - Approver email address
 * @param {string} params.requestId
 * @param {string} params.approverName   - Display name (e.g. 'Procurement Manager')
 * @param {string} [params.requesterName]
 * @param {string} params.summary        - Short human-readable request description
 * @param {string} params.aiDecision     - One-liner from decision.decision_summary
 * @param {string} params.justification  - Full text from decision.justification
 * @param {string} [params.link]         - Deep link placeholder
 * @param {Array}  [params.escalations]  - From escalationRouter output
 * @returns {Promise<{ success: boolean, provider: string, messageId?: string, error?: string }>}
 *
 * @example
 * // In process-stream/route.js, inside Step 5 (after requiredApprover is resolved):
 * if (!isAutoApproved && requiredApprover) {
 *   await sendApprovalEmail({
 *     to:            `${requiredApprover.toLowerCase().replace(/ /g, '.')}@company.com`,
 *     requestId:     reqId,
 *     approverName:  requiredApprover,
 *     summary:       `${enrichedRequest.quantity} × ${enrichedRequest.category_l2} · ${enrichedRequest.currency} ${enrichedRequest.budget_amount?.toLocaleString()}`,
 *     aiDecision:    decision.decision_summary,
 *     justification: decision.justification,
 *     escalations,
 *   });
 * }
 */
export async function sendApprovalEmail({
  to,
  requestId,
  approverName,
  requesterName,
  summary,
  aiDecision,
  justification,
  link,
  escalations = [],
}) {
  const template = buildApprovalEmailTemplate({
    requestId, approverName, requesterName,
    summary, aiDecision, justification, link, escalations,
  });

  try {
    const result = await _sendViaProvider({ to, ...template });
    logNotification({
      type: 'approval_request', to, requestId, status: 'sent',
      metadata: { approverName, messageId: result.messageId },
    });
    return result;
  } catch (err) {
    logNotification({
      type: 'approval_request', to, requestId, status: 'failed',
      metadata: { error: err.message },
    });
    console.error(`[NotificationService] sendApprovalEmail failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}


/**
 * Send a decision-result email to the requester.
 *
 * WHEN TO CALL: At the end of the pipeline, after decision is generated.
 * WHERE IN process-stream/route.js: in Step 5 (logged), before send('result', result).
 * Send regardless of status — requester always gets notified.
 *
 * @param {object} params
 * @param {string} params.to              - Requester email address
 * @param {string} params.requestId
 * @param {string} [params.requesterName]
 * @param {string} params.summary
 * @param {string} params.status          - 'recommended' | 'cannot_proceed' | 'partial_match'
 * @param {string} params.aiDecision
 * @param {string} params.justification
 * @param {string} [params.topSupplier]   - rankedSuppliers[0].supplier_name
 * @param {number} [params.confidenceScore]
 * @param {string} [params.link]
 * @returns {Promise<object>}
 *
 * @example
 * // In process-stream/route.js, Step 5 (before send('result', result)):
 * await sendDecisionEmail({
 *   to:              body.requesterEmail ?? 'requester@company.com',
 *   requestId:       reqId,
 *   summary:         `${enrichedRequest.quantity} × ${enrichedRequest.category_l2}`,
 *   status:          decision.status,
 *   aiDecision:      decision.decision_summary,
 *   justification:   decision.justification,
 *   topSupplier:     rankedSuppliers[0]?.supplier_name,
 *   confidenceScore: confidence,
 * });
 */
export async function sendDecisionEmail({
  to,
  requestId,
  requesterName,
  summary,
  status,
  aiDecision,
  justification,
  topSupplier,
  confidenceScore,
  link,
}) {
  const template = buildDecisionEmailTemplate({
    requestId, requesterName, summary,
    status, aiDecision, justification, topSupplier, confidenceScore, link,
  });

  try {
    const result = await _sendViaProvider({ to, ...template });
    logNotification({
      type: 'decision_result', to, requestId, status: 'sent',
      metadata: { decision_status: status, topSupplier, messageId: result.messageId },
    });
    return result;
  } catch (err) {
    logNotification({
      type: 'decision_result', to, requestId, status: 'failed',
      metadata: { error: err.message },
    });
    console.error(`[NotificationService] sendDecisionEmail failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}


/**
 * Send a reminder email to an approver who has not acted.
 *
 * WHEN TO CALL: From reminderService.checkPendingReminders() — not directly from pipeline.
 *
 * @param {object} params
 * @param {string} params.to
 * @param {string} params.requestId
 * @param {string} params.approverName
 * @param {string} params.summary
 * @param {number} params.pendingHours
 * @param {string} [params.link]
 * @returns {Promise<object>}
 */
export async function sendReminderEmail({ to, requestId, approverName, summary, pendingHours, link }) {
  const template = buildReminderEmailTemplate({ requestId, approverName, summary, pendingHours, link });

  try {
    const result = await _sendViaProvider({ to, ...template });
    logNotification({
      type: 'reminder', to, requestId, status: 'sent',
      metadata: { pendingHours, sentTo: approverName, messageId: result.messageId },
    });
    return result;
  } catch (err) {
    logNotification({
      type: 'reminder', to, requestId, status: 'failed',
      metadata: { error: err.message },
    });
    console.error(`[NotificationService] sendReminderEmail failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}
