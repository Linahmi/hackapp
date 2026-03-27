/**
 * emailTemplates.js
 *
 * Pure functions — no side effects, no imports, no external calls.
 * Each returns { subject, text, html }.
 *
 *   text — plain-text fallback and used for console logging in mock mode
 *   html — rendered in email clients
 *
 * To change provider styling: edit the HTML here only.
 * To change send logic: edit notificationService.js only.
 */

// ─── Approval Email ────────────────────────────────────────────────────────

/**
 * Email sent to the required approver asking them to act on a request.
 * Triggered after escalationRouter identifies who must approve.
 *
 * @param {object} params
 * @param {string} params.requestId
 * @param {string} params.approverName
 * @param {string} [params.requesterName]
 * @param {string} params.summary         - e.g. "240 Docking Stations · Berlin · EUR 28,000"
 * @param {string} params.aiDecision      - One-line AI recommendation
 * @param {string} params.justification   - Full justification text from decisionEngine
 * @param {string} [params.link]          - Deep link to request (placeholder until routing ready)
 * @param {Array}  [params.escalations]   - Array of escalation objects from escalationRouter
 * @returns {{ subject: string, text: string, html: string }}
 */
export function buildApprovalEmailTemplate({
  requestId,
  approverName,
  requesterName = 'Unknown Requester',
  summary,
  aiDecision,
  justification,
  link = '#',
  escalations = [],
}) {
  const subject = `[ProcureTrace] Action Required — Approval Needed for ${requestId}`;

  const escalationList = escalations
    .map(e => `  • ${e.trigger} → ${e.escalate_to}`)
    .join('\n');

  const text = `
Hello ${approverName},

A procurement request requires your approval.

REQUEST:   ${requestId}
REQUESTER: ${requesterName}
SUMMARY:   ${summary}

AI RECOMMENDATION:
${aiDecision}

JUSTIFICATION:
${justification}

ESCALATION REASONS:
${escalationList || '  None specified'}

Please review and approve or reject:
${link}

---
ProcureTrace | Automated Procurement Platform
This is an automated message. Do not reply directly.
`.trim();

  const escalationBlock = escalations.length > 0
    ? `<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;padding:12px 16px;margin:16px 0;">
        <p style="margin:0 0 8px;font-weight:bold;color:#92400e;">Escalation Reasons</p>
        <ul style="margin:0;padding-left:16px;color:#78350f;">
          ${escalations.map(e => `<li>${e.trigger}</li>`).join('')}
        </ul>
      </div>`
    : '';

  const html = `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
  <div style="background:#1e40af;padding:20px;border-radius:8px 8px 0 0;">
    <h2 style="color:white;margin:0;">Action Required — Approval Needed</h2>
    <p style="color:#bfdbfe;margin:4px 0 0;">${requestId}</p>
  </div>
  <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
    <p>Hello <strong>${approverName}</strong>,</p>
    <p>A procurement request submitted by <strong>${requesterName}</strong> requires your approval.</p>

    <div style="background:white;border:1px solid #e2e8f0;border-radius:6px;padding:16px;margin:16px 0;">
      <p style="margin:0 0 4px;font-weight:bold;color:#374151;">Request Summary</p>
      <p style="margin:0;color:#6b7280;">${summary}</p>
    </div>

    <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:12px 16px;margin:16px 0;border-radius:0 6px 6px 0;">
      <p style="margin:0 0 4px;font-weight:bold;color:#1d4ed8;">AI Recommendation</p>
      <p style="margin:0;">${aiDecision}</p>
    </div>

    <div style="margin:16px 0;">
      <p style="font-weight:bold;color:#374151;">Justification</p>
      <p style="color:#4b5563;">${justification}</p>
    </div>

    ${escalationBlock}

    <div style="text-align:center;margin:24px 0;">
      <a href="${link}" style="background:#1e40af;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">
        Review Request
      </a>
    </div>

    <p style="font-size:12px;color:#9ca3af;border-top:1px solid #e2e8f0;padding-top:12px;margin-top:24px;">
      ProcureTrace | Automated Procurement Platform<br>
      This is an automated message. Do not reply directly.
    </p>
  </div>
</body>
</html>`;

  return { subject, text, html };
}


// ─── Decision Email ────────────────────────────────────────────────────────

/**
 * Email sent to the requester with the final pipeline decision.
 * Triggered at the end of the pipeline (Step 5: logged).
 *
 * @param {object} params
 * @param {string} params.requestId
 * @param {string} [params.requesterName]
 * @param {string} params.summary
 * @param {string} params.status           - 'recommended' | 'cannot_proceed' | 'partial_match'
 * @param {string} params.aiDecision       - One-line summary from decisionEngine
 * @param {string} params.justification    - Full justification
 * @param {string} [params.topSupplier]    - Recommended supplier name
 * @param {number} [params.confidenceScore]
 * @param {string} [params.link]
 * @returns {{ subject: string, text: string, html: string }}
 */
export function buildDecisionEmailTemplate({
  requestId,
  requesterName = 'Team',
  summary,
  status,
  aiDecision,
  justification,
  topSupplier = null,
  confidenceScore = null,
  link = '#',
}) {
  const STATUS_META = {
    recommended:    { label: 'Approved for Award', color: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
    cannot_proceed: { label: 'Cannot Proceed',     color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
    partial_match:  { label: 'Partial Match',      color: '#d97706', bg: '#fffbeb', border: '#fcd34d' },
  };
  const s = STATUS_META[status] ?? STATUS_META.partial_match;

  const subject = `[ProcureTrace] Decision for ${requestId} — ${s.label}`;

  const text = `
Hello ${requesterName},

Your procurement request ${requestId} has been processed.

SUMMARY:  ${summary}
STATUS:   ${s.label}
${topSupplier    ? `SUPPLIER:    ${topSupplier}`      : ''}
${confidenceScore != null ? `CONFIDENCE:  ${confidenceScore}%` : ''}

AI DECISION:
${aiDecision}

JUSTIFICATION:
${justification}

View full details:
${link}

---
ProcureTrace | Automated Procurement Platform
`.trim();

  const supplierLine = topSupplier
    ? `<p style="margin:4px 0 0;color:#374151;">Recommended Supplier: <strong>${topSupplier}</strong></p>`
    : '';
  const confidenceLine = confidenceScore != null
    ? `<p style="margin:4px 0 0;color:#374151;">Confidence Score: <strong>${confidenceScore}%</strong></p>`
    : '';

  const html = `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
  <div style="background:#1e40af;padding:20px;border-radius:8px 8px 0 0;">
    <h2 style="color:white;margin:0;">Procurement Decision</h2>
    <p style="color:#bfdbfe;margin:4px 0 0;">${requestId}</p>
  </div>
  <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
    <p>Hello <strong>${requesterName}</strong>,</p>
    <p>Your procurement request has been processed.</p>

    <div style="background:white;border:1px solid #e2e8f0;border-radius:6px;padding:16px;margin:16px 0;">
      <p style="margin:0 0 4px;font-weight:bold;color:#374151;">Request Summary</p>
      <p style="margin:0;color:#6b7280;">${summary}</p>
    </div>

    <div style="background:${s.bg};border:1px solid ${s.border};border-radius:6px;padding:12px 16px;margin:16px 0;">
      <p style="margin:0;font-weight:bold;color:${s.color};">Status: ${s.label}</p>
      ${supplierLine}
      ${confidenceLine}
    </div>

    <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:12px 16px;margin:16px 0;border-radius:0 6px 6px 0;">
      <p style="margin:0 0 4px;font-weight:bold;color:#1d4ed8;">AI Decision</p>
      <p style="margin:0;">${aiDecision}</p>
    </div>

    <div style="margin:16px 0;">
      <p style="font-weight:bold;color:#374151;">Justification</p>
      <p style="color:#4b5563;">${justification}</p>
    </div>

    <div style="text-align:center;margin:24px 0;">
      <a href="${link}" style="background:#1e40af;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">
        View Full Report
      </a>
    </div>

    <p style="font-size:12px;color:#9ca3af;border-top:1px solid #e2e8f0;padding-top:12px;margin-top:24px;">
      ProcureTrace | Automated Procurement Platform<br>
      This is an automated message. Do not reply directly.
    </p>
  </div>
</body>
</html>`;

  return { subject, text, html };
}


// ─── Reminder Email ────────────────────────────────────────────────────────

/**
 * Reminder email sent to an approver who hasn't acted on a pending request.
 * Triggered by reminderService.checkPendingReminders().
 *
 * @param {object} params
 * @param {string} params.requestId
 * @param {string} params.approverName
 * @param {string} params.summary
 * @param {number} [params.pendingHours]   - Hours the request has been waiting
 * @param {string} [params.link]
 * @returns {{ subject: string, text: string, html: string }}
 */
export function buildReminderEmailTemplate({
  requestId,
  approverName,
  summary,
  pendingHours = 24,
  link = '#',
}) {
  const subject = `[ProcureTrace] Reminder — ${requestId} Awaiting Your Approval (${pendingHours}h)`;

  const text = `
Hello ${approverName},

This is a reminder that the following procurement request is still awaiting your approval.

REQUEST: ${requestId}
SUMMARY: ${summary}
PENDING: ${pendingHours} hour(s)

Please review and take action:
${link}

---
ProcureTrace | Automated Procurement Platform
`.trim();

  const html = `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
  <div style="background:#d97706;padding:20px;border-radius:8px 8px 0 0;">
    <h2 style="color:white;margin:0;">Reminder — Action Still Required</h2>
    <p style="color:#fef3c7;margin:4px 0 0;">${requestId} · Pending ${pendingHours}h</p>
  </div>
  <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
    <p>Hello <strong>${approverName}</strong>,</p>
    <p>The following procurement request has been <strong>waiting for your approval for ${pendingHours} hours</strong>.</p>

    <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;padding:16px;margin:16px 0;">
      <p style="margin:0 0 4px;font-weight:bold;color:#92400e;">${requestId}</p>
      <p style="margin:0;color:#78350f;">${summary}</p>
    </div>

    <div style="text-align:center;margin:24px 0;">
      <a href="${link}" style="background:#d97706;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">
        Review Now
      </a>
    </div>

    <p style="font-size:12px;color:#9ca3af;border-top:1px solid #e2e8f0;padding-top:12px;margin-top:24px;">
      ProcureTrace | Automated Procurement Platform<br>
      This is an automated message. Do not reply directly.
    </p>
  </div>
</body>
</html>`;

  return { subject, text, html };
}
