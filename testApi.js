fetch('http://localhost:3000/api/process', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: "Need 240 docking stations matching existing laptop fleet. Must be delivered by 2026-03-20. Budget capped at 25199.55 EUR. Please use Dell Enterprise Europe with no exception.",
    request_id: "REQ-000004"
  })
}).then(r => r.json()).then(r => console.log(JSON.stringify(r, null, 2)))
