import { NextResponse } from "next/server";
import { parseRequest } from "@/lib/intakeAgent";

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
    const result = await parseRequest(text.trim(), context ?? {});
    return NextResponse.json(result);
  } catch (err) {
    console.error("Intake agent error (fallback activated):", err);
    return NextResponse.json({
        request_id: "REQ-UNKNOWN",
        request_language: "en",
        category_l1: null,
        category_l2: null,
        title: "Unknown Request",
        quantity: null,
        unit_of_measure: "units",
        budget_amount: null,
        currency: "EUR",
        required_by_date: null,
        delivery_countries: [],
        preferred_supplier_stated: null,
        contract_type_requested: "purchase",
        data_residency_constraint: false,
        esg_requirement: false,
        gaps: ["category_l1", "category_l2", "quantity", "budget_amount", "delivery_countries"],
        confidence_score: 0,
        scenario_tags: [],
        processed_at: new Date().toISOString(),
        status: "pending_review"
    });
  }
}
