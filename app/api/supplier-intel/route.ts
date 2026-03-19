import { NextResponse } from "next/server";
import { searchSuppliers } from "@/lib/exaSupplierSearch";

export async function POST(request: Request): Promise<NextResponse> {
  let body: { suppliers?: string[]; category?: string; region?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid or missing JSON body" },
      { status: 400 },
    );
  }

  const { suppliers, category, region } = body;

  if (!suppliers || !Array.isArray(suppliers) || suppliers.length === 0) {
    return NextResponse.json(
      { error: "suppliers must be a non-empty array of strings" },
      { status: 400 },
    );
  }

  if (!category || typeof category !== "string") {
    return NextResponse.json(
      { error: "category is required and must be a string" },
      { status: 400 },
    );
  }

  // Cap at 5 suppliers to avoid excessive API calls
  const capped = suppliers.slice(0, 5);

  try {
    const results = await searchSuppliers(capped, category, region);
    return NextResponse.json({ results }, { status: 200 });
  } catch (err) {
    console.error("[supplier-intel] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
