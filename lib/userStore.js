/**
 * userStore.js
 *
 * DB-backed store for registered user accounts (via Prisma users table).
 * Hardcoded demo users in lib/users.js are always checked first.
 */

import { prisma } from '@/lib/prisma';

export async function findRegisteredUser(email) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  return user ? { ...user, title: null } : null;
}

export async function createUser({ name, email, password, role = 'requester' }) {
  const user = await prisma.user.create({
    data: {
      email:    email.toLowerCase().trim(),
      name:     name.trim(),
      role,
      password, // plain-text for demo only — hash with bcrypt in production
    },
  });
  const { password: _p, ...safe } = user;
  return { ...safe, title: null };
}

export async function listRegisteredUsers() {
  const users = await prisma.user.findMany({ orderBy: { created_at: 'asc' } });
  return users.map(({ password: _p, ...u }) => ({ ...u, title: null }));
}
