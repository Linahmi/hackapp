import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const text = body.text || "";
    
    if (!text || text.trim().length === 0) {
      return NextResponse.json({ quantity: false, budget: false, location: false, timeline: false });
    }

    const USE_MOCK = !process.env.AZURE_OPENAI_KEY;
    if (USE_MOCK) {
      // Mock logic simulating AI delay
      await new Promise(r => setTimeout(r, 400));
      return NextResponse.json({
         quantity: /\\b\\d+\\b/i.test(text) || /(one|two|three|four|five|six|seven|eight|nine|ten)/i.test(text),
         budget: /(budget|\\$|€|k|m|eur|usd|chf)/i.test(text),
         location: /(geneva|kigali|europe|berlin|london|paris|office|delivery)/i.test(text),
         timeline: /(weeks?|days?|months?|asap|urgent|noon|morning)/i.test(text)
      });
    }

    const response = await fetch(
      `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=2024-05-01-preview`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': process.env.AZURE_OPENAI_KEY
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'Analyze the procurement request snippet. Return JSON with exactly these 4 boolean keys indicating if the concept is mentioned: "quantity", "budget", "location", "timeline". Reply ONLY with JSON.' },
            { role: 'user', content: text }
          ],
          max_tokens: 50,
          temperature: 0.1,
          response_format: { type: 'json_object' }
        })
      }
    );

    if (!response.ok) {
      throw new Error('Azure API error');
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    return NextResponse.json({
        quantity: !!result.quantity,
        budget: !!result.budget,
        location: !!result.location,
        timeline: !!result.timeline
    });

  } catch (err) {
    console.error("Live validate error:", err);
    return NextResponse.json({ quantity: false, budget: false, location: false, timeline: false });
  }
}
