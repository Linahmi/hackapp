import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/pipeline";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body must be a JSON object (structured request)" }, { status: 400 });
  }

  try {
    const result = await runPipeline(body);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Pipeline error:", err);
    return NextResponse.json(
      { error: "Pipeline processing failed", details: err.message },
      { status: 500 }
    );
  }
}
