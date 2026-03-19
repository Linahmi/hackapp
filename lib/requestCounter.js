import fs from 'fs';
import path from 'path';

const COUNTER_FILE = path.join(process.cwd(), 'data', 'request_counter.json');

function ensureFile() {
  const dir = path.dirname(COUNTER_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(COUNTER_FILE)) {
    fs.writeFileSync(COUNTER_FILE, JSON.stringify({ counter: 0, requests: [] }));
  }
}

export function getNextRequestId() {
  ensureFile();
  const data = JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf-8'));
  data.counter += 1;
  const id = `R-${String(data.counter).padStart(4, '0')}`;
  fs.writeFileSync(COUNTER_FILE, JSON.stringify(data, null, 2));
  return id;
}

export function logRequest(requestId, summary) {
  ensureFile();
  const data = JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf-8'));
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
  fs.writeFileSync(COUNTER_FILE, JSON.stringify(data, null, 2));
}

export function getRequestHistory() {
  ensureFile();
  const data = JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf-8'));
  return data.requests;
}
