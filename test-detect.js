import { detectBundlingOpportunity } from './lib/bundlingDetector.js';
import { POST } from './app/api/process/route.js';

async function mockReq(id, text) {
  return { json: async () => ({ text: text, request_id: id }) };
}

async function getMatches(id) {
  const req = await mockReq(id, "");
  const res = await POST(req);
  const data = await res.json();
  console.log(data.bundling_opportunity);
}
getMatches("REQ-000038");
