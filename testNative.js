import { POST } from './app/api/process/route.js';
import fs from 'fs';

const mockRequest = {
  json: async () => ({
    text: "Need 240 docking stations matching existing laptop fleet. Must be delivered by 2026-03-20 with premium specification. Budget capped at 25199.55 EUR. Please use Dell Enterprise Europe with no exception.",
    request_id: "REQ-000004"
  })
};

async function run() {
  try {
    const response = await POST(mockRequest);
    const data = await response.json();
    fs.writeFileSync('out3.json', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Test failed:", err);
  }
}

run();
