import fs from 'fs';
import path from 'path';

const COUNTER_FILE = path.join(process.cwd(), 'data', 'request_counter.json');

// Vercel serverless has a read-only filesystem. Writes are silently skipped
// so the core API never crashes; the counter just won't persist between invocations.
function safeWrite(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch {
    // Read-only filesystem (e.g. Vercel production) — ignore write failures
  }
}

function ensureFile() {
  try {
    const dir = path.dirname(COUNTER_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(COUNTER_FILE)) {
      safeWrite(COUNTER_FILE, { counter: 0, requests: [] });
    }
  } catch {
    // ignore
  }
}

function readFile() {
  try {
    return JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf-8'));
  } catch {
    return { counter: 0, requests: [] };
  }
}

export function getNextRequestId() {
  ensureFile();
  const data = readFile();
  data.counter += 1;
  const id = `R-${String(data.counter).padStart(4, '0')}`;
  safeWrite(COUNTER_FILE, data);
  return id;
}

export function logRequest(requestId, summary) {
  ensureFile();
  const data = readFile();
  data.requests.push({
    id: requestId,
    timestamp: new Date().toISOString(),
    category: summary.category || null,
    quantity: summary.quantity || null,
    budget: summary.budget || null,
    status: summary.status || 'pending',
  });
  // Keep last 500 requests
  if (data.requests.length > 500) data.requests = data.requests.slice(-500);
  safeWrite(COUNTER_FILE, data);
}

export function getRequestHistory() {
  ensureFile();
  return readFile().requests;
}
