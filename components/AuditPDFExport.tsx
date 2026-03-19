"use client";

import React from "react";
import * as XLSX from "xlsx";

interface Props {
  data: any;
}

export default function AuditPDFExport({ data }: Props) {
  if (!data) return null;

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // 1. Supplier Comparison
    const supplierRows = (data.supplier_shortlist || []).map((s: any) => ({
      Rank: s.rank || "",
      Supplier: s.supplier_name || "",
      Preferred: s.preferred ? "Yes" : "No",
      Incumbent: s.incumbent ? "Yes" : "No",
      "Unit Price": s.unit_price ?? "N/A",
      "Total Price": s.total_price ?? "N/A",
      Currency: data.request_interpretation?.currency || "N/A",
      "Lead Time (std)": s.standard_lead_time_days ?? "N/A",
      "Lead Time (exp)": s.expedited_lead_time_days ?? "N/A",
      Quality: s.quality_score ?? "N/A",
      Risk: s.risk_score ?? "N/A",
      ESG: s.esg_score ?? "N/A",
      "Score (%)": s.composite_score_pct ?? s.composite_score ?? "N/A",
      "Policy Compliant": s.policy_compliant ? "Yes" : "No",
      Notes: s.recommendation_note || ""
    }));
    
    // Fallback if empty
    const wsSuppliers = XLSX.utils.json_to_sheet(
      supplierRows.length > 0 ? supplierRows : [ {
        Rank: "", Supplier: "", Preferred: "", Incumbent: "", "Unit Price": "", "Total Price": "", Currency: "", "Lead Time (std)": "", "Lead Time (exp)": "", Quality: "", Risk: "", ESG: "", "Score (%)": "", "Policy Compliant": "", Notes: ""
      } ]
    );
    XLSX.utils.book_append_sheet(wb, wsSuppliers, "Supplier Comparison");

    // 2. Decision Summary
    const decisionRows = [
      { Label: "Request ID", Value: data.request_id || "N/A" },
      { Label: "Category L1", Value: data.request_interpretation?.category_l1 || "N/A" },
      { Label: "Category L2", Value: data.request_interpretation?.category_l2 || "N/A" },
      { Label: "Quantity", Value: data.request_interpretation?.quantity || "N/A" },
      { Label: "Budget", Value: data.request_interpretation?.budget_amount || "N/A" },
      { Label: "Currency", Value: data.request_interpretation?.currency || "N/A" },
      { Label: "Delivery Countries", Value: (data.request_interpretation?.delivery_countries || []).join(", ") || "N/A" },
      { Label: "Required By", Value: data.request_interpretation?.required_by_date || "N/A" },
      { Label: "Preferred Supplier", Value: data.request_interpretation?.preferred_supplier_stated || "N/A" },
      { Label: "Detected Language", Value: data.request_interpretation?.detected_language || "N/A" },
      { Label: "", Value: "" },
      { Label: "Validation Status", Value: data.validation?.issues?.length > 0 ? "FAIL" : "PASS" },
      { Label: "Issues Count", Value: String(data.validation?.issues?.length || 0) },
      { Label: "", Value: "" },
      { Label: "Approval Tier", Value: data.policy_evaluation?.approval_tier?.tier || "N/A" },
      { Label: "Quotes Required", Value: String(data.policy_evaluation?.approval_tier?.quotes_required || 0) },
      { Label: "Approver", Value: data.policy_evaluation?.approval_tier?.approver || "N/A" },
      { Label: "", Value: "" },
      { Label: "Decision Status", Value: data.recommendation?.status || "N/A" },
      { Label: "Confidence Score", Value: data.confidence_score !== null ? String(data.confidence_score) : "N/A" },
      { Label: "Auto Approved", Value: data.recommendation?.is_auto_approved ? "Yes" : "No" },
      { Label: "Rationale", Value: data.recommendation?.rationale || data.recommendation?.reason || "N/A" },
      { Label: "", Value: "" },
      { Label: "Escalations Count", Value: String(data.escalations?.length || 0) },
      { Label: "Escalation details", Value: (data.escalations || []).map((e: any) => `[${e.id}] ${e.trigger} -> ${e.escalate_to}${e.blocking ? " (BLOCKING)" : ""}`).join("; ") || "None" }
    ];
    const wsDecision = XLSX.utils.json_to_sheet(decisionRows, { header: ["Label", "Value"], skipHeader: true });
    XLSX.utils.book_append_sheet(wb, wsDecision, "Decision Summary");

    // 3. Audit Trail
    const auditRows = [
      { Item: "Policies Checked", Value: (data.audit_trail?.policies_checked || []).join(", ") || "None" },
      { Item: "Suppliers Evaluated", Value: (data.audit_trail?.suppliers_evaluated || []).join(", ") || "None" },
      { Item: "Data Sources", Value: (data.audit_trail?.data_sources_used || []).join(", ") || "None" },
      { Item: "Historical Awards Consulted", Value: data.audit_trail?.historical_awards_consulted ? "Yes" : "No" },
      { Item: "Assumptions", Value: (data.audit_trail?.assumptions || []).join(", ") || "None" },
      { Item: "Inference Applied", Value: data.audit_trail?.inference_applied ? "Yes" : "No" },
      { Item: "Generated At", Value: data.processed_at || new Date().toISOString() }
    ];
    const wsAudit = XLSX.utils.json_to_sheet(auditRows);
    XLSX.utils.book_append_sheet(wb, wsAudit, "Audit Trail");

    const dateStr = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `ProcureTrace_Audit_${data.request_id || "Unknown"}_${dateStr}.xlsx`);
  };

  return (
    <>
      <div className="w-full max-w-2xl mt-4 flex items-center justify-end gap-3 no-print">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-[color:var(--text-main)] transition-colors hover:bg-white/10"
        >
          ▤ Export Audit Record (PDF)
        </button>
        <button
          onClick={handleExportExcel}
          className="flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-[color:var(--text-main)] transition-colors hover:bg-white/10"
        >
          ⬇ Export to Excel
        </button>
      </div>

      <div id="audit-document" className="hidden print:block text-black bg-white font-serif p-0 m-0">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body { background: white !important; color: black !important; padding: 0 !important; margin: 0 !important; }
            #audit-document { display: block !important; padding: 1.5cm; max-width: 100%; width: 100%; font-family: Georgia, serif; font-size: 11pt; line-height: 1.5; box-sizing: border-box; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .page-break { page-break-before: always; }
            @page { margin: 0; }
          }
        `}} />
        
        {/* HEADER */}
        <div className="border-b-2 border-black pb-4 mb-6">
          <h1 className="text-3xl font-bold uppercase tracking-tight mb-1">Procurement Decision Record</h1>
          <p className="text-sm font-semibold italic text-gray-700">Audit-Ready Sourcing Decision</p>
          <div className="mt-4 text-xs font-mono grid grid-cols-2 gap-2 text-gray-600">
            <div><strong>Request ID:</strong> {data.request_id}</div>
            <div><strong>Processed At:</strong> {new Date(data.processed_at || Date.now()).toUTCString()}</div>
            <div><strong>Classification:</strong> Highly Confidential</div>
            <div><strong>System:</strong> ProcureTrace AI</div>
          </div>
        </div>

        {/* REQUEST SUMMARY */}
        <div className="mb-6">
          <h2 className="text-lg font-bold border-b border-gray-300 pb-1 mb-3 uppercase tracking-wide">1. Request Summary</h2>
          <div className="grid grid-cols-2 gap-y-2 text-sm mb-4">
            <div><strong>Category:</strong> {data.request_interpretation?.category_l1} &gt; {data.request_interpretation?.category_l2}</div>
            <div><strong>Quantity:</strong> {data.request_interpretation?.quantity}</div>
            <div><strong>Budget:</strong> {data.request_interpretation?.budget_amount} {data.request_interpretation?.currency}</div>
            <div><strong>Delivery:</strong> {data.request_interpretation?.delivery_countries?.join(", ")}</div>
            <div><strong>Required Date:</strong> {data.request_interpretation?.required_by_date}</div>
            <div><strong>Language:</strong> {data.request_interpretation?.detected_language}</div>
            <div className="col-span-2"><strong>Preferred Supplier:</strong> {data.request_interpretation?.preferred_supplier_stated || "None"}</div>
          </div>
          <p className="text-sm italic border-l-2 border-gray-300 pl-2">Goal: Address immediate procurement need based on submitted request.</p>
        </div>

        {/* FIELD PROVENANCE */}
        <div className="mb-8 p-4 border border-gray-200 bg-gray-50">
          <h2 className="text-md font-bold mb-2 uppercase tracking-wide text-gray-800">2. Field Provenance & Assumptions</h2>
          <div className="text-sm">
            {data.request_interpretation?.field_sources && Object.entries(data.request_interpretation.field_sources).length > 0 ? (
              <ul className="list-disc pl-5 mb-3">
                {Object.entries(data.request_interpretation.field_sources).map(([key, val]) => (
                  <li key={key}><strong>{key}:</strong> {String(val).toUpperCase()}</li>
                ))}
              </ul>
            ) : <p>All fields explicitly stated by requester.</p>}
            
            <div className="mt-2 text-sm">
              <strong>Assumptions Applied: </strong>
              {data.audit_trail?.assumptions?.length ? (
                 <ul className="list-disc pl-5 mt-1">
                   {data.audit_trail.assumptions.map((a: string, i: number) => <li key={i}>{a}</li>)}
                 </ul>
              ) : "None"}
            </div>
          </div>
        </div>

        {/* VALIDATION */}
        <div className="mb-6">
          <h2 className="text-lg font-bold border-b border-gray-300 pb-1 mb-3 uppercase tracking-wide">3. Validation Findings</h2>
          {data.validation?.issues?.length > 0 ? (
            <div className="text-sm border-l-4 border-red-500 pl-3">
              <div className="font-bold text-red-600 mb-2">FAIL - Validation Issues Detected</div>
              <ul className="list-decimal pl-4">
                {data.validation.issues.map((iss: any, i: number) => (
                  <li key={i} className="mb-2">
                    <strong>[{iss.severity?.toUpperCase()}] {iss.type}:</strong> {iss.description} <br/>
                    <em>Required Action: {iss.action}</em>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm font-semibold text-green-700 border-l-4 border-green-500 pl-3">PASS - No completeness or consistency issues detected.</p>
          )}
        </div>

        {/* POLICY */}
        <div className="mb-6">
          <h2 className="text-lg font-bold border-b border-gray-300 pb-1 mb-3 uppercase tracking-wide">4. Policy Evaluation</h2>
          <div className="grid grid-cols-2 gap-y-2 text-sm mb-3">
            <div><strong>Approval Tier:</strong> {data.policy_evaluation?.approval_tier?.tier || "N/A"}</div>
            <div><strong>Quotes Required:</strong> {data.policy_evaluation?.approval_tier?.quotes_required || "N/A"}</div>
            <div className="col-span-2"><strong>Required Approver:</strong> {data.policy_evaluation?.approval_tier?.approver || "N/A"}</div>
            {data.policy_evaluation?.preferred_supplier && (
              <div className="col-span-2"><strong>Eligible Supplier Guard:</strong> Rule actively checked.</div>
            )}
          </div>
          
          <div className="text-sm mt-3 border-t border-dashed border-gray-300 pt-2">
             <strong>Violations: </strong> {data.policy_evaluation?.violations?.length ? (
               <ul className="list-disc pl-5 mt-1 text-red-600">
                 {data.policy_evaluation.violations.map((v: string, i: number) => <li key={i}>{v}</li>)}
               </ul>
             ) : "None"}
          </div>
        </div>

        <div className="page-break"></div>

        {/* SUPPLIER EVALUATION */}
        <div className="mb-6">
          <h2 className="text-lg font-bold border-b border-gray-300 pb-1 mb-3 uppercase tracking-wide">5. Supplier Evaluation</h2>
          <div className="mb-2 text-xs text-gray-600">Scoring Weights: 35% Price / 25% Lead Time / 20% Quality / 15% Risk / 5% ESG</div>
          {data.supplier_shortlist?.length > 0 ? (
            <table className="w-full text-sm text-left border-collapse mt-2">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-400">
                  <th className="py-2 px-2">Rank</th>
                  <th className="py-2 px-2">Supplier</th>
                  <th className="py-2 px-2 border-l border-gray-300">Total Price</th>
                  <th className="py-2 px-2 border-l border-gray-300">Lead Time</th>
                  <th className="py-2 px-2 border-l border-gray-300">Score</th>
                </tr>
              </thead>
              <tbody>
                {data.supplier_shortlist.map((s: any, i: number) => (
                  <tr key={i} className="border-b border-gray-200">
                    <td className="py-2 px-2">#{s.rank || (i+1)}</td>
                    <td className="py-2 px-2 font-bold">{s.supplier_name} {s.preferred ? "(Preferred)" : ""}</td>
                    <td className="py-2 px-2 border-l border-gray-200">{s.total_price} {data.request_interpretation?.currency}</td>
                    <td className="py-2 px-2 border-l border-gray-200">{s.standard_lead_time_days} days</td>
                    <td className="py-2 px-2 border-l border-gray-200 text-green-700 font-bold">{s.composite_score_pct} / 100</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm border-l-2 border-gray-300 pl-2">No supplier shortlist available - constraints likely blocked mapping.</p>
          )}
          {data.recommendation?.recommended_supplier_rationale && (
            <p className="mt-3 text-sm italic"><strong>Rationale:</strong> {data.recommendation.recommended_supplier_rationale}</p>
          )}
        </div>

        {/* ESCALATIONS */}
        <div className="mb-6">
          <h2 className="text-lg font-bold border-b border-gray-300 pb-1 mb-3 uppercase tracking-wide">6. Escalation Record</h2>
          {data.escalations?.length > 0 ? (
            <div className="text-sm border border-red-300 bg-red-50 p-3">
              <p className="font-bold text-red-800 mb-2">⚠ Blocking escalations require immediate human approval before continuing.</p>
              <ul className="list-disc pl-5">
                {data.escalations.map((e: any, i: number) => (
                  <li key={i} className="mb-1">
                    <strong>[{e.id}]</strong> {e.trigger} &mdash; <em>Escalate to: {e.escalate_to}</em> 
                    {e.blocking && <span className="text-red-700 font-bold"> (BLOCKING)</span>}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-green-700 border-l-4 border-green-500 pl-3">No escalations required. Decision made within policy.</p>
          )}
        </div>

        {/* BUNDLING */}
        {data.bundling_opportunity && data.bundling_opportunity.opportunity_detected && (
          <div className="mb-6">
            <h2 className="text-lg font-bold border-b border-gray-300 pb-1 mb-3 uppercase tracking-wide">7. Bundling Opportunity</h2>
            <div className="text-sm border border-blue-200 bg-blue-50 p-3">
              <p className="font-bold text-blue-800 mb-1">{data.bundling_opportunity.title}</p>
              <p className="mb-2 text-gray-700">{data.bundling_opportunity.description}</p>
              <p><strong>Estimated Saving:</strong> {data.bundling_opportunity.estimated_saving} {data.bundling_opportunity.currency} ({data.bundling_opportunity.saving_pct}% reduction)</p>
              {data.bundling_opportunity.dynamic_pricing_projection && (
                <p className="mt-1"><strong>Financial Projection:</strong> {data.bundling_opportunity.dynamic_pricing_projection.message}</p>
              )}
              <p className="mt-2 text-xs text-gray-500 italic">Antitrust Guard: {data.bundling_opportunity.antitrust_note}</p>
            </div>
          </div>
        )}

        {/* DECISION RECORD */}
        <div className="mb-6">
          <h2 className="text-lg font-bold border-b border-gray-300 pb-1 mb-3 uppercase tracking-wide">8. Decision Record</h2>
          <div className="p-4 border-2 border-black bg-gray-50 text-sm">
            <div className="grid grid-cols-2 gap-y-2 mb-3">
              <div><strong>Status:</strong> <span className="uppercase font-bold">{String(data.recommendation?.status).replace("_", " ")}</span></div>
              <div><strong>Confidence Score:</strong> {data.confidence_score != null ? `${data.confidence_score}%` : "N/A"}</div>
              <div className="col-span-2"><strong>Auto-Approved:</strong> {data.recommendation?.is_auto_approved ? "Yes" : "No"}</div>
            </div>
            <p><strong>Rationale:</strong> {data.recommendation?.rationale || data.recommendation?.reason}</p>
            {data.recommendation?.status === "cannot_proceed" && (
              <p className="mt-3 font-bold text-red-600">⚠ CLEAR NEED FOR HUMAN INTERVENTION REQUIRED.</p>
            )}
          </div>
        </div>

        {/* SYSTEM AUDIT */}
        <div className="mb-10 text-xs text-gray-500">
          <h2 className="font-bold border-b border-gray-300 pb-1 mb-2 uppercase tracking-wide text-gray-700">9. System Audit Logs</h2>
          <p><strong>Policies Checked:</strong> {data.audit_trail?.policies_checked?.join(", ")}</p>
          <p><strong>Data Sources:</strong> {data.audit_trail?.data_sources_used?.join(", ")}</p>
          <p><strong>Inference Applied:</strong> {data.audit_trail?.inference_applied ? "Yes" : "No"}</p>
        </div>

        {/* LEGAL FOOTER */}
        <div className="border-t-2 border-black pt-3 text-[10px] text-gray-400 text-center uppercase tracking-widest mt-auto">
          <p>Generated by ProcureTrace AI — Confidential Internal Record</p>
          <p className="mt-1">This is a non-binding decision. Final fiduciary authorization remains strictly subject to human review.</p>
          <p className="mt-1">Timestamp: {new Date().toUTCString()} | Traceability Engine Execution</p>
        </div>
      </div>
    </>
  );
}
