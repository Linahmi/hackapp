/**
 * draftStore.js
 *
 * Persists request drafts to data/drafts.json.
 * A draft is free-text that a requester saves before submitting to the pipeline.
 *
 * Lifecycle:
 *   POST /api/drafts          → create draft (status: 'draft')
 *   PUT  /api/drafts/[id]     → update text
 *   POST /api/drafts/[id]/submit → mark as submitted, returns text for process-stream
 *   DELETE /api/drafts/[id]   → delete
 *
 * Shape maps to a future `drafts` DB table.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const FILE = path.join(process.cwd(), 'data', 'drafts.json');

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

function newDraftId() {
  return `D-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Create a new draft.
 * @param {{ requesterId: string, text: string, title?: string }} params
 * @returns {object} the draft record
 */
export function createDraft({ requesterId, text, title = null }) {
  const data = safeRead();
  const id   = newDraftId();
  const now  = new Date().toISOString();

  const draft = {
    id,
    requester_id:        requesterId,
    title:               title ?? text.slice(0, 60).replace(/\n/g, ' '),
    text,
    status:              'draft',       // 'draft' | 'submitted'
    created_at:          now,
    updated_at:          now,
    submitted_at:        null,
    linked_request_id:   null,          // filled when /claim is called
  };

  data[id] = draft;
  safeWrite(data);
  return draft;
}

/**
 * Update the text (and optionally title) of a draft.
 * Only allowed while status === 'draft'.
 *
 * @param {string} draftId
 * @param {{ text?: string, title?: string }} fields
 * @returns {object|null} updated draft, or null if not found / already submitted
 */
export function updateDraft(draftId, { text, title }) {
  const data  = safeRead();
  const draft = data[draftId];
  if (!draft || draft.status !== 'draft') return null;

  if (text  !== undefined) draft.text  = text;
  if (title !== undefined) draft.title = title;
  draft.updated_at = new Date().toISOString();

  safeWrite(data);
  return draft;
}

/**
 * Mark a draft as submitted. Returns the draft text so the caller
 * can forward it to process-stream.
 *
 * @param {string} draftId
 * @param {string} requesterId - must match draft.requester_id
 * @returns {{ text: string, draft: object } | null}
 */
export function submitDraft(draftId, requesterId) {
  const data  = safeRead();
  const draft = data[draftId];
  if (!draft) return null;
  if (draft.requester_id !== requesterId) return null;
  if (draft.status === 'submitted') return null;

  draft.status       = 'submitted';
  draft.submitted_at = new Date().toISOString();
  draft.updated_at   = draft.submitted_at;

  safeWrite(data);
  return { text: draft.text, draft };
}

/**
 * Link a submitted draft to its assigned request_id (after process-stream returns).
 * @param {string} draftId
 * @param {string} requestId - e.g. 'R-0093'
 * @returns {object|null}
 */
export function linkDraftToRequest(draftId, requestId) {
  const data  = safeRead();
  const draft = data[draftId];
  if (!draft) return null;

  draft.linked_request_id = requestId;
  draft.updated_at        = new Date().toISOString();

  safeWrite(data);
  return draft;
}

/**
 * Delete a draft (only if still in 'draft' status).
 * @param {string} draftId
 * @param {string} requesterId
 * @returns {boolean}
 */
export function deleteDraft(draftId, requesterId) {
  const data  = safeRead();
  const draft = data[draftId];
  if (!draft || draft.requester_id !== requesterId) return false;
  if (draft.status === 'submitted') return false;

  delete data[draftId];
  safeWrite(data);
  return true;
}

/**
 * Get one draft by ID.
 * @param {string} draftId
 * @returns {object|null}
 */
export function getDraft(draftId) {
  return safeRead()[draftId] ?? null;
}

/**
 * List all drafts belonging to a requester.
 * @param {string} requesterId
 * @returns {object[]}
 */
export function listDraftsByRequester(requesterId) {
  const data = safeRead();
  return Object.values(data)
    .filter(d => d.requester_id === requesterId)
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
}
