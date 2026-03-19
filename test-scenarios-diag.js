import { POST } from './app/api/process/route.js';

async function run() {
  const req1 = { json: async () => ({ text: "Need IT Project Management Services...", request_id: "REQ-000001" }) };
  const res1 = await POST(req1);
  const data1 = await res1.json();
  console.log("\n=== SCENARIO 2 (REQ-000001) ===");
  console.log(JSON.stringify(data1.escalations, null, 2));
}
run();
