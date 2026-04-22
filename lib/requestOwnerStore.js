/**
 * requestOwnerStore.js
 *
 * Maps request IDs to their owner (requester) in data/request_owners.json.
 *
 * Why a separate file instead of modifying process-stream:
 *   process-stream assigns the reqId internally and is off-limits.
 *   The client receives the reqId from the SSE 'result' event, then calls
 *   POST /api/requests/[id]/claim to associate it with the logged-in user.
 *
 * Shape maps to a future `request_owners` DB table.
 */

import fs from 'fs';
import path from 'path';

const FILE = path.join(process.cwd(), 'data', 'request_owners.json');

function safeRead() {
  try {
    if (fs.existsSync(FILE)) return JSON.parse(fs.readFileSync(FILE, 'utf-8'));
  } catch {}
  return {};
}

function safeWrite(data) {
  try {
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  } catch {}
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Claim ownership of a request.
 * Safe to call once — silently ignores duplicate claims for the same requestId.
 *
 * @param {string} requestId      - e.g. 'R-0093'
 * @param {object} requester      - { id, email, name }
 * @param {string} [draftId]      - optional draft this request was submitted from
 * @returns {object} the ownership record
 */
export function claimRequest(requestId, { id, email, name }, draftId = null) {
  const data = safeRead();

  // Idempotent — don't overwrite an existing claim
  if (data[requestId]) return data[requestId];

  const record = {
    request_id:   requestId,
    owner_id:     id,
    owner_email:  email,
    owner_name:   name,
    claimed_at:   new Date().toISOString(),
    draft_id:     draftId,
  };

  data[requestId] = record;
  safeWrite(data);
  return record;
}

/**
 * Get the owner record for a request.
 * @param {string} requestId
 * @returns {object|null}
 */
export function getOwner(requestId) {
  return safeRead()[requestId] ?? null;
}

/**
 * List all requests owned by a specific user.
 * @param {string} ownerId
 * @returns {string[]} array of request IDs, newest first
 */
export function getRequestIdsByOwner(ownerId) {
  const data = safeRead();
  return Object.values(data)
    .filter(r => r.owner_id === ownerId)
    .sort((a, b) => new Date(b.claimed_at) - new Date(a.claimed_at))
    .map(r => r.request_id);
}

/**
 * Check if a user owns a specific request.
 * Checks the file store first; falls back to the DB if no file record exists.
 * @param {string} requestId
 * @param {string} ownerId
 * @returns {Promise<boolean>}
 */
export async function isOwner(requestId, ownerId) {
  const record = safeRead()[requestId];
  if (record) return record.owner_id === ownerId;

  try {
    const { prisma } = await import('@/lib/prisma');
    const req = await prisma.request.findUnique({
      where: { id: requestId },
      select: { requester_id: true },
    });
    return req?.requester_id === ownerId;
  } catch {
    return false;
  }
}
