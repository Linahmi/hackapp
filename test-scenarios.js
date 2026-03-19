import { POST } from './app/api/process/route.js';

async function mockReq(id, text) {
  return { json: async () => ({ text: text, request_id: id }) };
}

async function run() {
  const req4 = await mockReq("REQ-000004", "Need 240 docking stations matching existing laptop fleet. Must be delivered by 2026-03-20. Budget capped at 25199.55 EUR. Please use Dell Enterprise Europe with no exception.");
  const res4 = await POST(req4);
  const data4 = await res4.json();
  console.log("=== SCENARIO 1 (REQ-000004) ===");
  console.log("Status:", data4.recommendation?.status);
  console.log("Escalations Count:", data4.escalations?.length);
  console.log("Blocking Escalation Triggers:");
  (data4.escalations || []).filter(e => e.blocking).forEach(e => console.log(` - ${e.trigger}`));

  const req1 = await mockReq("REQ-000001", "Need IT Project Management Services for the Q3 migration initiative.");
  const res1 = await POST(req1);
  const data1 = await res1.json();
  console.log("\n=== SCENARIO 2 (REQ-000001) ===");
  console.log("Status:", data1.recommendation?.status);
  console.log("Auto Approved:", data1.recommendation?.is_auto_approved);
  console.log("Top Supplier:", data1.supplier_shortlist?.[0]?.supplier_name);
}
run();
