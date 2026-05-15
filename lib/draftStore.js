/**
 * draftStore.js
 *
 * In-memory store for request drafts.
 * Drafts are transient pre-submission state; losing them on a cold start is
 * acceptable. Replace with a DB-backed store (e.g. a `drafts` Prisma model)
 * if persistence across deployments is required.
 */

import crypto from 'crypto';

const _store = new Map(); // draftId → draft object

function newDraftId() {
  return `D-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

// ─── Public API ────────────────────────────────────────────────────────────

export function createDraft({ requesterId, text, title = null }) {
  const id  = newDraftId();
  const now = new Date().toISOString();
  const draft = {
    id,
    requester_id:      requesterId,
    title:             title ?? text.slice(0, 60).replace(/\n/g, ' '),
    text,
    status:            'draft',
    created_at:        now,
    updated_at:        now,
    submitted_at:      null,
    linked_request_id: null,
  };
  _store.set(id, draft);
  return draft;
}

export function updateDraft(draftId, { text, title }) {
  const draft = _store.get(draftId);
  if (!draft || draft.status !== 'draft') return null;
  if (text  !== undefined) draft.text  = text;
  if (title !== undefined) draft.title = title;
  draft.updated_at = new Date().toISOString();
  return draft;
}

export function submitDraft(draftId, requesterId) {
  const draft = _store.get(draftId);
  if (!draft)                              return null;
  if (draft.requester_id !== requesterId)  return null;
  if (draft.status === 'submitted')        return null;
  draft.status       = 'submitted';
  draft.submitted_at = new Date().toISOString();
  draft.updated_at   = draft.submitted_at;
  return { text: draft.text, draft };
}

export function linkDraftToRequest(draftId, requestId) {
  const draft = _store.get(draftId);
  if (!draft) return null;
  draft.linked_request_id = requestId;
  draft.updated_at        = new Date().toISOString();
  return draft;
}

export function deleteDraft(draftId, requesterId) {
  const draft = _store.get(draftId);
  if (!draft || draft.requester_id !== requesterId) return false;
  if (draft.status === 'submitted')                  return false;
  _store.delete(draftId);
  return true;
}

export function getDraft(draftId) {
  return _store.get(draftId) ?? null;
}

export function listDraftsByRequester(requesterId) {
  return [..._store.values()]
    .filter(d => d.requester_id === requesterId)
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
}
