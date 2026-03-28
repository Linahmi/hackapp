/**
 * users.js
 *
 * Hardcoded user list and approver email map.
 * Replace with DB query when a users table is ready.
 *
 * Roles:
 *   requester — can submit requests, sees only their own
 *   manager   — sees all PENDING_APPROVAL requests, can approve/reject
 *   admin     — full access
 */

// ─── Approver email map ────────────────────────────────────────────────────
// Maps the requiredApprover title (from the pipeline) to a real email address.
// process-stream/route.js resolves requiredApprover = 'Procurement Manager' etc.
export const APPROVER_EMAIL_MAP = {
  'Procurement Manager':       'alice@company.com',
  'Head of Category':          'bob@company.com',
  'Head of Strategic Sourcing':'charlie@company.com',
  'CPO':                       'cpo@company.com',
};

/**
 * Resolve the email address for a given approver title.
 * @param {string} approverTitle - e.g. 'Procurement Manager'
 * @returns {string|null}
 */
export function getApproverEmail(approverTitle) {
  return APPROVER_EMAIL_MAP[approverTitle] ?? null;
}

// ─── User list ─────────────────────────────────────────────────────────────
// Passwords are plain-text for hackathon use only.
// In production: hash with bcrypt and store in DB.
export const USERS = [
  {
    id:       'u001',
    email:    'alice@company.com',
    password: 'alice123',
    name:     'Alice Martin',
    role:     'manager',
    title:    'Procurement Manager',
  },
  {
    id:       'u002',
    email:    'bob@company.com',
    password: 'bob123',
    name:     'Bob Chen',
    role:     'manager',
    title:    'Head of Category',
  },
  {
    id:       'u003',
    email:    'charlie@company.com',
    password: 'charlie123',
    name:     'Charlie Davis',
    role:     'manager',
    title:    'Head of Strategic Sourcing',
  },
  {
    id:       'u004',
    email:    'requester@company.com',
    password: 'req123',
    name:     'John Requester',
    role:     'requester',
    title:    null,
  },
  {
    id:       'u005',
    email:    'admin@company.com',
    password: 'admin123',
    name:     'Admin User',
    role:     'admin',
    title:    null,
  },
];

/**
 * Find a user by email address (case-insensitive).
 * @param {string} email
 * @returns {object|null}
 */
export function findUserByEmail(email) {
  return USERS.find(u => u.email.toLowerCase() === email.toLowerCase()) ?? null;
}

/**
 * Find the manager user(s) responsible for a given approver title.
 * Used to scope GET /api/approvals to the logged-in manager.
 * @param {string} email
 * @returns {string|null} - The title matching this manager's email in APPROVER_EMAIL_MAP
 */
export function getApproverTitleByEmail(email) {
  const entry = Object.entries(APPROVER_EMAIL_MAP).find(([, v]) => v.toLowerCase() === email.toLowerCase());
  return entry ? entry[0] : null;
}
