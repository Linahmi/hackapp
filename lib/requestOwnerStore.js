/**
 * requestOwnerStore.js
 *
 * Ownership lookups backed directly by the requests table (requester_id column).
 * All functions are async.
 */

import { prisma } from '@/lib/prisma';

export async function claimRequest(requestId, { id, email, name }, _draftId = null) {
  // Idempotent: only set requester_id if not already claimed
  const existing = await prisma.request.findUnique({
    where: { id: requestId },
    select: { requester_id: true, created_at: true },
  });
  if (!existing) return null;
  if (!existing.requester_id) {
    await prisma.request.update({
      where: { id: requestId },
      data:  { requester_id: id },
    });
  }
  return {
    request_id:  requestId,
    owner_id:    existing.requester_id ?? id,
    owner_email: email,
    owner_name:  name,
    claimed_at:  existing.created_at.toISOString(),
  };
}

export async function getOwner(requestId) {
  const req = await prisma.request.findUnique({
    where:  { id: requestId },
    select: { id: true, requester_id: true, created_at: true, requester: { select: { email: true, name: true } } },
  });
  if (!req || !req.requester_id) return null;
  return {
    request_id:  req.id,
    owner_id:    req.requester_id,
    owner_email: req.requester?.email ?? null,
    owner_name:  req.requester?.name ?? null,
    claimed_at:  req.created_at.toISOString(),
  };
}

export async function getRequestIdsByOwner(ownerId) {
  const rows = await prisma.request.findMany({
    where:   { requester_id: ownerId },
    select:  { id: true },
    orderBy: { created_at: 'desc' },
  });
  return rows.map(r => r.id);
}

export async function isOwner(requestId, ownerId) {
  const req = await prisma.request.findUnique({
    where:  { id: requestId },
    select: { requester_id: true },
  });
  return req?.requester_id === ownerId;
}
