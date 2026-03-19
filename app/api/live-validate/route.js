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
         quantity: /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn)\b/i.test(text),
         budget: /(budget|\$|€|£|eur|usd|chf|franc|euro|dollar|kosten|preis)/i.test(text) || /\b(k|m)\b/i.test(text),
         location: /\b(geneva|genève|genf|kigali|europe|berlin|london|paris|office|bureaux|büro|delivery|livraison|lieferung|casablanca|maroc|france|suisse|schweiz|canada|usa|us|uk|fr|de|germany|deutschland|ville|pays|country|land)\b/i.test(text) || /\b(in|à|a|nach)\s+[a-z]+/i.test(text),
         timeline: /\b(weeks?|days?|months?|years?|asap|urgent|noon|morning|by|q[1-4]|202[0-9]|soon|demain|matin|soir|jour|semaine|mois|an|année|rapidement|vite|bientôt|morgen|heute|woche|monat|jahr|schnell|dringend)\b/i.test(text)
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
            { role: 'system', content: 'Analyze the procurement request snippet (it may be in any language, e.g., English, French). Return JSON with exactly these 4 boolean keys indicating if the concept is mentioned: "quantity", "budget", "location" (e.g., city, country, office), "timeline" (e.g., tomorrow, demain matin, urgent). Reply ONLY with JSON.' },
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
