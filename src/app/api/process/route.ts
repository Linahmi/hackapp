import { NextResponse } from "next/server";
import { validateOrder } from "../../../lib/validator";
import { decide } from "../../../lib/decisionEngine";

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;

  // Step 1: parse request body
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid or missing JSON body" },
      { status: 400 },
    );
  }

  // Step 2: validate
  let validationResult: ReturnType<typeof validateOrder>;
  try {
    validationResult = validateOrder(body);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  if (!validationResult.valid) {
    return NextResponse.json({ errors: validationResult.errors }, { status: 400 });
  }

  // Step 3: decide
  let decision: Awaited<ReturnType<typeof decide>>;
  try {
    decision = await decide(validationResult.data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  if (decision.outcome === "cannot_proceed") {
    return NextResponse.json({ reason: decision.reason }, { status: 422 });
  }

  return NextResponse.json({ recommendation: decision.recommendation }, { status: 200 });
}
