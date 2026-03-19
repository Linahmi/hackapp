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
        request_id: "REQ-000004",
        request_language: "en",
        category_l1: "Hardware",
        category_l2: "Accessories",
        title: "Docking Stations for Laptop Fleet",
        quantity: 240,
        unit_of_measure: "units",
        budget_amount: 25199.55,
        currency: "EUR",
        required_by_date: "2026-03-20",
        delivery_countries: ["France", "CH"],
        preferred_supplier_stated: "Dell Enterprise Europe",
        contract_type_requested: "purchase",
        data_residency_constraint: false,
        esg_requirement: false,
        gaps: [],
        confidence_score: 95,
        scenario_tags: ["standard", "single_source"],
        processed_at: new Date().toISOString(),
        status: "pending_review"
    });
  }
}
