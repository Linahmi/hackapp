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
  out += `Interpretation: ${JSON.stringify(data.request_interpretation)}\n`;
  out += `Assumptions: ${JSON.stringify(data.audit_trail?.assumptions)}\n`;
  out += `Inference Applied: ${data.audit_trail?.inference_applied}\n`;
  out += `Validation / Escalations Impact: ${data.escalations?.length} escalations\n`;
  if (data.escalations?.length > 0) {
    data.escalations.forEach(e => { out += `  - ${e.trigger}\n`; });
  }
  return out;
}

async function runAll() {
  let final = "";
  final += await runTest("REQ-000004", "Need 240 docking stations...", "Test 1: REQ-000004 (Edge Case)");
  final += await runTest("REQ-000039", "Need software licensing...", "Test 2: REQ-000039 (Missing Budget, auto-refills or blocks)");
  final += await runTest("REQ-000099", "Need hardware upgrades...", "Test 3: REQ-000099 (Missing Budget)");
  fs.writeFileSync('test-out.txt', final);
  console.log("Wrote to test-out.txt text file successfully!");
}

runAll();
