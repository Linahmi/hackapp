import { POST } from './app/api/process/route.js';
import fs from 'fs';

async function mockReq(id, text) {
  return { json: async () => ({ text: text, request_id: id }) };
}

async function runTest(id, text, desc) {
  const req = await mockReq(id, text);
  const res = await POST(req);
  const data = await res.json();
  
  let out = `\n=== SCENARIO: ${desc} ===\n`;
  const b = data.bundling_opportunity;
  if (!b) {
    out += "bundling_opportunity: null\n";
  } else {
    out += `opportunity_detected: ${b.opportunity_detected}\n`;
    out += `current_quantity: ${b.current_quantity}\n`;
    out += `combined_quantity: ${b.combined_quantity}\n`;
    out += `similar_requests_count: ${b.similar_requests_count}\n`;
    out += `saving_pct: ${b.saving_pct}\n`;
    out += `dynamic_pricing_projection: ${JSON.stringify(b.dynamic_pricing_projection)}\n`;
    out += `esg_benefit: ${b.esg_benefit}\n`;
    out += `description: ${b.description}\n`;
  }
  return out;
}

async function runAll() {
  try {
    let final = "";
    final += await runTest("REQ-000064", "checking docking stations", "Test 1: REQ-000064");
    final += await runTest("REQ-000038", "large laptop request", "Test 2: REQ-000038");
    final += await runTest("REQ-000004", "edge case docking station", "Test 3: REQ-000004");
    fs.writeFileSync('test-out-bundling.txt', final);
    console.log("Wrote to test-out-bundling.txt successfully.");
  } catch(e) {
    fs.writeFileSync('test-out-bundling.txt', e.stack);
  }
}

runAll();
