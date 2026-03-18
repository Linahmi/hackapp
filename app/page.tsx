"use client";

import { useState } from "react";
import RequestInput from "../components/RequestInput";
import RequestInterpretation from "../components/RequestInterpretation";
import PolicyCheck from "../components/PolicyCheck";
import SupplierComparison from "../components/SupplierComparison";

export default function Home() {
  const [analyzed, setAnalyzed] = useState(false);

  return (
    <div
      className="flex flex-col items-center gap-8 px-4 py-16"
      style={{ backgroundColor: "#0f1117", minHeight: "calc(100vh - 49px)" }}
    >
      <RequestInput onAnalyze={() => setAnalyzed(true)} />
      {analyzed && <RequestInterpretation />}
      {analyzed && <PolicyCheck />}
      {analyzed && <SupplierComparison />}
    </div>
  );
}
