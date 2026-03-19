import { POST } from './app/api/process/route.js';

const mockRequest = {
  json: async () => ({
    text: "Need 240 docking stations matching existing laptop fleet. Must be delivered by 2026-03-20. Budget capped at 25199.55 EUR. Please use Dell Enterprise Europe with no exception.",
    request_id: "REQ-000004"
  })
};

async function test() {
  const res = await POST(mockRequest);
  const json = await res.json();
  console.log(JSON.stringify(json, null, 2));
}

test();
