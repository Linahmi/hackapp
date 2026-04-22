/**
 * userStore.js
 *
 * File-backed user store for registered accounts (data/users.json).
 * Hardcoded users from lib/users.js are always checked first as defaults.
 * New registrations are saved here.
 *
 * In production: replace with a DB table.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const FILE = path.join(process.cwd(), 'data', 'users.json');

function safeRead() {
  try {
    if (fs.existsSync(FILE)) return JSON.parse(fs.readFileSync(FILE, 'utf-8'));
  } catch {}
  return [];
}

function safeWrite(data) {
  try {
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  } catch {}
}

function newUserId() {
  return crypto.randomUUID();
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Find a registered user by email (file store only).
 * @param {string} email
 * @returns {object|null}
 */
export function findRegisteredUser(email) {
  const users = safeRead();
  return users.find(u => u.email.toLowerCase() === email.toLowerCase()) ?? null;
}

/**
 * Create a new user account.
 * Caller is responsible for checking the email isn't already taken.
 *
 * @param {{ name: string, email: string, password: string, role: string }} params
 * @returns {object} the created user (without password)
 */
export function createUser({ name, email, password, role = 'requester' }) {
  const users = safeRead();

  const user = {
    id:         newUserId(),
    email:      email.toLowerCase().trim(),
    password,                               // plain-text — hackapp only
    name:       name.trim(),
    role,
    title:      null,
    created_at: new Date().toISOString(),
  };

  users.push(user);
  safeWrite(users);

  const { password: _p, ...safe } = user;
  return safe;
}

/**
 * List all registered users (admin use).
 * @returns {object[]} users without passwords
 */
export function listRegisteredUsers() {
  return safeRead().map(({ password: _p, ...u }) => u);
}
