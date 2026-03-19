"use client";

import React from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";

interface Props {
  data: any;
}

export default function AuditPDFExport({ data }: Props) {
  if (!data) return null;

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

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

    const wsSuppliers = XLSX.utils.json_to_sheet(
      supplierRows.length > 0 ? supplierRows : [{
        Rank: "", Supplier: "", Preferred: "", Incumbent: "", "Unit Price": "", "Total Price": "", Currency: "", "Lead Time (std)": "", "Lead Time (exp)": "", Quality: "", Risk: "", ESG: "", "Score (%)": "", "Policy Compliant": "", Notes: ""
      }]
    );
    XLSX.utils.book_append_sheet(wb, wsSuppliers, "Supplier Comparison");

    const decisionRows = [
      { Label: "Category", Value: `${data.request_interpretation?.category_l1} > ${data.request_interpretation?.category_l2}` },
      { Label: "Quantity", Value: data.request_interpretation?.quantity || "N/A" },
      { Label: "Budget", Value: `${data.request_interpretation?.budget_amount || "N/A"} ${data.request_interpretation?.currency || ""}` },
      { Label: "Delivery Countries", Value: (data.request_interpretation?.delivery_countries || []).join(", ") || "N/A" },
      { Label: "Required By", Value: data.request_interpretation?.required_by_date || "N/A" },
      { Label: "Preferred Supplier", Value: data.request_interpretation?.preferred_supplier_stated || "None" },
      { Label: "", Value: "" },
      { Label: "Decision Status", Value: data.recommendation?.status || "N/A" },
      { Label: "Confidence Score", Value: data.confidence_score !== null ? String(data.confidence_score) : "N/A" },
      { Label: "Auto Approved", Value: data.recommendation?.is_auto_approved ? "Yes" : "No" },
      { Label: "Rationale", Value: data.recommendation?.rationale || data.recommendation?.reason || "N/A" },
    ];
    const wsDecision = XLSX.utils.json_to_sheet(decisionRows, { header: ["Label", "Value"], skipHeader: true });
    XLSX.utils.book_append_sheet(wb, wsDecision, "Decision Summary");

    const auditRows = [
      { Item: "Policies Checked", Value: (data.audit_trail?.policies_checked || []).join(", ") || "None" },
      { Item: "Suppliers Evaluated", Value: (data.audit_trail?.suppliers_evaluated || []).join(", ") || "None" },
      { Item: "Data Sources", Value: (data.audit_trail?.data_sources_used || []).join(", ") || "None" },
      { Item: "Generated At", Value: data.processed_at || new Date().toISOString() }
    ];
    const wsAudit = XLSX.utils.json_to_sheet(auditRows);
    XLSX.utils.book_append_sheet(wb, wsAudit, "Audit Trail");

    const dateStr = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `ProcureTrace_Audit_${dateStr}.xlsx`);
  };

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const auditDoc = (
    <div id="audit-document" className="hidden print:block text-black font-serif p-0 m-0" style={{ background: "white" }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          #audit-document { 
            display: block !important; 
            padding: 1.5cm; 
            max-width: 100%; 
            width: 100%; 
            font-family: Georgia, serif; 
            font-size: 10pt; 
            line-height: 1.5; 
            box-sizing: border-box; 
          }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          @page { margin: 0; size: A4 portrait; }
          
          .audit-section-title {
            text-transform: uppercase;
            font-weight: bold;
            font-size: 11pt;
            border-left: 3px solid #0F6E56;
            padding-left: 8px;
            margin-bottom: 6px;
            margin-top: 16px;
            color: black;
            break-after: avoid;
          }
          .audit-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10pt;
            margin-top: 6px;
            margin-bottom: 4px;
          }
          .audit-table tr {
            break-inside: avoid;
          }
          .audit-table th, .audit-table td {
            border: 1px solid #ccc;
            padding: 4px 6px;
            text-align: left;
          }
          .audit-table th {
            background-color: #0F6E56;
            color: white;
            font-weight: bold;
          }
          .audit-table tbody tr:nth-child(even) {
            background-color: #fafafa;
          }
          .audit-record-box {
            break-inside: avoid;
          }
          .text-red { color: #d32f2f !important; }
          .text-green { color: #2e7d32 !important; }
          .mono { font-family: monospace; }
        }
      `}} />

      {/* BRANDED HEADER */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "12px" }}>
          <div>
            <div style={{ fontSize: "24pt", fontWeight: "bold", lineHeight: 1 }}>
              <span style={{ color: "#0F6E56" }}>Chain</span>
              <span style={{ color: "#5DCAA5" }}>IQ</span>
            </div>
            <div style={{ borderTop: "1px solid #0F6E56", width: "100%", marginTop: "4px", paddingTop: "4px" }}>
              <span style={{ color: "#666", fontSize: "10pt" }}>Procurement Intelligence Platform</span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "14pt", fontWeight: "bold", textTransform: "uppercase", color: "#000" }}>PROCUREMENT DECISION RECORD</div>
            <div style={{ fontSize: "11pt", fontStyle: "italic", color: "#666", marginBottom: "4px" }}>Audit-Ready Sourcing Decision</div>
            <div style={{ fontFamily: "monospace", fontSize: "9pt", color: "#000" }}>Request ID: {data.request_id || "N/A"}</div>
            <div style={{ fontSize: "9pt", color: "#000" }}>Processed At: {data.processed_at ? new Date(data.processed_at).toUTCString() : "N/A"}</div>
          </div>
        </div>
        <div style={{ borderTop: "2px solid #0F6E56", width: "100%", marginBottom: "12px" }}></div>
        <p style={{ fontSize: "9pt", fontStyle: "italic", color: "#666" }}>
          This document constitutes a formal, immutable systemic record of the autonomous procurement evaluation executed by the ChainIQ decision engine. All supplier evaluations, policy checks, and routing decisions are documented below for compliance verification.
        </p>
      </div>

      {/* 1. REQUEST SUMMARY */}
      <h2 className="audit-section-title">1. REQUEST SUMMARY</h2>
      <table className="audit-table">
        <tbody>
          <tr>
            <td style={{ width: "25%" }}><strong>Category</strong></td>
            <td>{data.request_interpretation?.category_l1 || "N/A"} &gt; {data.request_interpretation?.category_l2 || "N/A"}</td>
          </tr>
          <tr>
            <td><strong>Quantity</strong></td>
            <td>{data.request_interpretation?.quantity ?? "N/A"}</td>
          </tr>
          <tr>
            <td><strong>Budget</strong></td>
            <td>{data.request_interpretation?.budget_amount ?? "N/A"} {data.request_interpretation?.currency || ""}</td>
          </tr>
          <tr>
            <td><strong>Delivery Countries</strong></td>
            <td>{(data.request_interpretation?.delivery_countries || []).join(", ") || "N/A"}</td>
          </tr>
          <tr>
            <td><strong>Required Date</strong></td>
            <td>{data.request_interpretation?.required_by_date || "N/A"}</td>
          </tr>
          <tr>
            <td><strong>Preferred Supplier</strong></td>
            <td>{data.request_interpretation?.preferred_supplier_stated || "N/A"}</td>
          </tr>
        </tbody>
      </table>

      {/* 2. FIELD PROVENANCE */}
      <h2 className="audit-section-title">2. FIELD PROVENANCE</h2>
      <div style={{ border: "1px solid #ccc", padding: "12px", backgroundColor: "#f9f9f9" }}>
        {data.request_interpretation?.field_sources && Object.keys(data.request_interpretation.field_sources).length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}>
            <tbody>
              {Object.entries(data.request_interpretation.field_sources).map(([k, v]) => (
                <tr key={k}>
                  <td style={{ width: "40%", paddingBottom: "4px" }}><strong>{k}</strong></td>
                  <td style={{ fontFamily: "monospace", paddingBottom: "4px" }}>{String(v).toUpperCase()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>All inputs explicitly stated by requester.</p>
        )}

        {data.audit_trail?.assumptions && data.audit_trail.assumptions.length > 0 && (
          <div style={{ marginTop: "12px", borderTop: "1px solid #ddd", paddingTop: "8px" }}>
            <strong>Assumptions Applied:</strong>
            <ul style={{ margin: "4px 0 0 20px", fontSize: "9pt" }}>
              {data.audit_trail.assumptions.map((a: string, i: number) => <li key={i}>{a}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* 3. VALIDATION FINDINGS */}
      <h2 className="audit-section-title">3. VALIDATION FINDINGS</h2>
      {data.validation?.issues?.length > 0 ? (
        <div>
          <p className="text-red" style={{ fontWeight: "bold", marginBottom: "8px" }}>FAIL — Validation issues detected</p>
          <table className="audit-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Type / Severity</th>
                <th>Description</th>
                <th>Action Required</th>
              </tr>
            </thead>
            <tbody>
              {data.validation.issues.map((iss: any, i: number) => (
                <tr key={i}>
                  <td className="mono">{iss.id || "N/A"}</td>
                  <td><strong>{iss.type || "N/A"}</strong><br/>{iss.severity?.toUpperCase() || "N/A"}</td>
                  <td>{iss.description || "N/A"}</td>
                  <td>{iss.action || "N/A"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-green" style={{ fontWeight: "bold" }}>PASS — Request validation successful. No critical gaps identified.</p>
      )}

      {/* 4. POLICY EVALUATION */}
      <h2 className="audit-section-title">4. POLICY EVALUATION</h2>
      <table className="audit-table">
        <tbody>
          <tr>
            <td style={{ width: "30%" }}><strong>Approval Tier</strong></td>
            <td>Tier {data.policy_evaluation?.approval_tier?.tier ?? "N/A"} ({data.policy_evaluation?.approval_tier?.approver || "N/A"})</td>
          </tr>
          <tr>
            <td><strong>Quotes Required</strong></td>
            <td>{data.policy_evaluation?.approval_tier?.quotes_required ?? "N/A"}</td>
          </tr>
          <tr>
            <td><strong>Preferred Supplier Check</strong></td>
            <td>{data.policy_evaluation?.preferred_supplier ? "Evaluated against active policy constraints" : "No preferred supplier nominated"}</td>
          </tr>
        </tbody>
      </table>
      {data.policy_evaluation?.violations?.length > 0 && (
        <div style={{ marginTop: "12px", padding: "12px", border: "1px solid #d32f2f", backgroundColor: "#ffebee" }}>
          <strong className="text-red">Policy Violations Detected:</strong>
          <ul style={{ margin: "4px 0 0 20px" }}>
            {data.policy_evaluation.violations.map((v: string, i: number) => <li key={i} className="text-red">{v}</li>)}
          </ul>
        </div>
      )}

      {/* 5. SUPPLIER EVALUATION */}
      <h2 className="audit-section-title">5. SUPPLIER EVALUATION</h2>
      {data.supplier_shortlist?.length > 0 ? (
        <table className="audit-table">
          <thead>
            <tr>
              <th>Rnk</th>
              <th>Supplier Name</th>
              <th>Match</th>
              <th>Total Price</th>
              <th>Lead Time</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {data.supplier_shortlist.map((s: any, i: number) => (
              <tr key={i} style={{ backgroundColor: s.rank === 1 ? "rgba(15, 110, 86, 0.05)" : undefined }}>
                <td>{s.rank || i + 1}</td>
                <td><strong>{s.supplier_name || "Unknown"}</strong> {s.incumbent ? "(Incumbent)" : ""}</td>
                <td>{s.preferred ? "Preferred" : "Standard"}</td>
                <td>{s.total_price ?? "N/A"} {data.request_interpretation?.currency || "EUR"}</td>
                <td>{s.standard_lead_time_days ?? "N/A"} days</td>
                <td><strong>{s.composite_score_pct ?? s.composite_score ?? "N/A"}/100</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No eligible suppliers met the structural constraints of this request.</p>
      )}

      {/* 6. ESCALATION RECORD */}
      <h2 className="audit-section-title">6. ESCALATION RECORD</h2>
      {data.escalations?.length > 0 ? (
        <table className="audit-table">
          <thead>
            <tr>
              <th style={{ width: "15%" }}>Escalation ID</th>
              <th style={{ width: "45%" }}>Trigger Condition</th>
              <th style={{ width: "25%" }}>Routed To</th>
              <th style={{ width: "15%" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.escalations.map((e: any, i: number) => (
              <tr key={i} style={{ color: e.blocking ? "#d32f2f" : "inherit", fontWeight: e.blocking ? "bold" : "normal" }}>
                <td className="mono">{e.id || "N/A"}</td>
                <td>{e.trigger || "N/A"}</td>
                <td><strong>{e.escalate_to || "N/A"}</strong></td>
                <td><strong>{e.blocking ? "BLOCKING" : "FYI"}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-green" style={{ fontWeight: "bold" }}>No systemic escalations triggered. Request remains cleanly within policy boundaries.</p>
      )}

      {/* 7. BUNDLING OPPORTUNITY (Conditional) */}
      {data.bundling_opportunity && data.bundling_opportunity.opportunity_detected && (
        <>
          <h2 className="audit-section-title">7. BUNDLING OPPORTUNITY</h2>
          <div className="audit-record-box" style={{ padding: "12px", border: "1px solid #ccc", backgroundColor: "#f0f8ff", marginBottom: "24px" }}>
            <p style={{ fontWeight: "bold", marginBottom: "4px" }}>{data.bundling_opportunity.title || "Opportunity Detected"}</p>
            <p style={{ marginBottom: "8px" }}>{data.bundling_opportunity.description || "N/A"}</p>
            <table style={{ width: "100%", fontSize: "10pt" }}>
              <tbody>
                <tr>
                  <td style={{ width: "30%" }}><strong>Est. Savings:</strong></td>
                  <td>{data.bundling_opportunity.estimated_saving ?? "N/A"} {data.bundling_opportunity.currency || ""} (-{data.bundling_opportunity.saving_pct ?? 0}%)</td>
                </tr>
                <tr>
                  <td><strong>Antitrust Guard:</strong></td>
                  <td style={{ fontStyle: "italic" }}>{data.bundling_opportunity.antitrust_note || "N/A"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* DECISION RECORD */}
      <h2 className="audit-section-title">{data.bundling_opportunity?.opportunity_detected ? "8. DECISION RECORD" : "7. DECISION RECORD"}</h2>
      <div className="audit-record-box" style={{ padding: "16px", border: "2px solid black", backgroundColor: "#fafafa", marginBottom: "24px" }}>
        <table style={{ width: "100%", fontSize: "12pt", marginBottom: "12px" }}>
          <tbody>
            <tr>
              <td style={{ width: "150px" }}><strong>Final Status:</strong></td>
              <td className={data.recommendation?.status === "cannot_proceed" ? "text-red" : "text-green"} style={{ fontWeight: "bold", textTransform: "uppercase" }}>
                {(data.recommendation?.status || "N/A").replace(/_/g, " ")}
              </td>
            </tr>
            <tr>
              <td><strong>Confidence:</strong></td>
              <td>{data.confidence_score ?? "N/A"}/100</td>
            </tr>
            <tr>
              <td><strong>Auto-Approved:</strong></td>
              <td>{data.recommendation?.is_auto_approved ? "Yes" : "No"}</td>
            </tr>
          </tbody>
        </table>
        <div style={{ borderTop: "1px solid #ccc", paddingTop: "12px" }}>
          <strong>Rationale:</strong>
          <p style={{ marginTop: "4px" }}>{data.recommendation?.rationale || data.recommendation?.reason || "N/A"}</p>
        </div>
      </div>

      {/* AUDIT TRAIL */}
      <h2 className="audit-section-title">{data.bundling_opportunity?.opportunity_detected ? "9. AUDIT TRAIL" : "8. AUDIT TRAIL"}</h2>
      <table className="audit-table">
        <tbody>
          <tr>
            <td style={{ width: "30%" }}><strong>Policies Evaluated</strong></td>
            <td className="mono">{(data.audit_trail?.policies_checked || []).join(", ") || "N/A"}</td>
          </tr>
          <tr>
            <td><strong>Suppliers Evaluated</strong></td>
            <td className="mono">{(data.audit_trail?.supplier_ids_evaluated || data.audit_trail?.suppliers_evaluated || []).join(", ") || "N/A"}</td>
          </tr>
          <tr>
            <td><strong>Data Sources Checked</strong></td>
            <td className="mono">{(data.audit_trail?.data_sources_used || []).join(", ") || "N/A"}</td>
          </tr>
          <tr>
            <td><strong>Generated Timestamp</strong></td>
            <td className="mono">{data.audit_trail?.generated_at || data.processed_at || new Date().toISOString()}</td>
          </tr>
        </tbody>
      </table>

      {/* FOOTER */}
      <div style={{ marginTop: "24px", paddingTop: "12px", borderTop: "1px solid black", fontSize: "8pt", textAlign: "center", textTransform: "uppercase", color: "#666" }}>
        <p><strong>CONFIDENTIAL & PROPRIETARY</strong> — ChainIQ ProcureTrace System Record</p>
        <p style={{ marginTop: "4px" }}>Doc ID: {data.request_id || "SYS"}-AUDIT-{Date.now()} | This is a machine-generated systemic ledger. Fiduciary execution requires human verification.</p>
      </div>
    </div>
  );

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

      {mounted && typeof document !== "undefined" ? createPortal(auditDoc, document.body) : null}
    </>
  );
}
