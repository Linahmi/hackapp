/**
 * approvalStore.js
 *
 * Persists approval decisions to data/approvals.json.
 * Uses the same safe-write pattern as requestCounter.js.
 *
 * Data shape:
 *   { [requestId]: ApprovalRecord }
 *
 * ApprovalRecord:
 *   {
 *     request_id:       string,
 *     approval_status:  'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED',
 *     required_approver: string | null,   // title, e.g. 'Procurement Manager'
 *     summary:          string | null,
 *     requester_id:     string | null,
 *     created_at:       ISO string,
 *     decided_by:       string | null,    // userId of approver
 *     decided_at:       ISO string | null,
 *     comment:          string | null,
 *   }
 */

import fs from 'fs';
import path from 'path';

const FILE = path.join(process.cwd(), 'data', 'approvals.json');

// ─── File I/O ──────────────────────────────────────────────────────────────

function safeRead() {
  try {
    if (fs.existsSync(FILE)) {
      return JSON.parse(fs.readFileSync(FILE, 'utf-8'));
    }
  } catch {
    // ignore
  }
  return {};
}

function safeWrite(data) {
  try {
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  } catch {
    // Read-only filesystem (e.g. Vercel) — skip silently
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Record a decision (APPROVED or REJECTED) for a request.
 * Creates the record if it doesn't exist yet.
 *
 * @param {string} requestId
 * @param {{ status: string, userId: string, comment?: string, requiredApprover?: string, summary?: string }} fields
 * @returns {object} the saved record
 */
export function setDecision(requestId, { status, userId, comment = null, requiredApprover = null, summary = null }) {
  const data = safeRead();
  const existing = data[requestId] ?? {
    request_id:        requestId,
    required_approver: requiredApprover,
    summary:           summary,
    requester_id:      'system',
    created_at:        new Date().toISOString(),
  };

  data[requestId] = {
    ...existing,
    approval_status: status,
    decided_by:      userId,
    decided_at:      new Date().toISOString(),
    comment,
  };

  safeWrite(data);
  return data[requestId];
}

/**
 * Get the approval record for one request.
 * @param {string} requestId
 * @returns {object|null}
 */
export function getApproval(requestId) {
  const data = safeRead();
  return data[requestId] ?? null;
}

/**
 * List all records that are still PENDING_APPROVAL.
 * @returns {object[]}
 */
export function listPendingApprovals() {
  const data = safeRead();
  return Object.values(data).filter(r => r.approval_status === 'PENDING_APPROVAL');
}

/**
 * List all approval records.
 * @returns {object[]}
 */
export function listAllApprovals() {
  return Object.values(safeRead());
}

/**
 * Check whether a decision has already been made for this request.
 * @param {string} requestId
 * @returns {boolean}
 */
export function isDecided(requestId) {
  const record = getApproval(requestId);
  return record !== null && record.approval_status !== 'PENDING_APPROVAL';
}
