import { NextResponse } from "next/server";
import { runIntakeAgent } from "@/lib/intakeAgent";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { text, context } = body;

  if (!text || typeof text !== "string" || text.trim() === "") {
    return NextResponse.json(
      { error: "Missing required field: 'text' (non-empty string)" },
      { status: 400 }
    );
  }

  try {
    const result = await runIntakeAgent(text.trim(), context ?? {});
    return NextResponse.json(result);
  } catch (err) {
    console.error("Intake agent error:", err);
    return NextResponse.json(
      { error: "Failed to process request", details: err.message },
      { status: 500 }
    );
  }
}
