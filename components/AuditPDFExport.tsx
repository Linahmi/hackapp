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
      supplierRows.length > 0 ? supplierRows : [ {
        Rank: "", Supplier: "", Preferred: "", Incumbent: "", "Unit Price": "", "Total Price": "", Currency: "", "Lead Time (std)": "", "Lead Time (exp)": "", Quality: "", Risk: "", ESG: "", "Score (%)": "", "Policy Compliant": "", Notes: ""
      } ]
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

  const interp = data.request_interpretation;
  const rec = data.recommendation;
  const hasBlocking = data.escalations?.some((e: any) => e.blocking);
  const statusColor = rec?.status === "recommended" ? "#166534" : "#991b1b";
  const statusBg = rec?.status === "recommended" ? "#f0fdf4" : "#fef2f2";

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

      <div id="audit-document" className="hidden print:block text-black bg-white p-0 m-0">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            html, body { background: white !important; color: #111 !important; margin: 0 !important; padding: 0 !important; }
            nav, .no-print { display: none !important; }
            #audit-document {
              display: block !important;
              padding: 40pt 50pt;
              width: 100%;
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
              font-size: 9.5pt;
              line-height: 1.55;
              color: #111;
            }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .page-break { page-break-before: always; }
            @page { margin: 0; size: A4; }
            table { border-collapse: collapse; width: 100%; }
            th, td { padding: 6pt 8pt; text-align: left; }
            .pdf-section { margin-bottom: 22pt; }
            .pdf-section-title {
              font-size: 10pt;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.8pt;
              color: #374151;
              border-bottom: 2px solid #dc2626;
              padding-bottom: 4pt;
              margin-bottom: 10pt;
            }
            .pdf-kv { display: grid; grid-template-columns: 140pt 1fr; gap: 3pt 12pt; }
            .pdf-kv-label { font-weight: 600; color: #374151; }
            .pdf-kv-value { color: #111; }
          }
        `}} />
        
        {/* ─── HEADER ─── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3px solid #dc2626", paddingBottom: "14pt", marginBottom: "20pt" }}>
          <div>
            <div style={{ fontSize: "22pt", fontWeight: 800, letterSpacing: "-0.5pt", color: "#111" }}>ProcureTrace</div>
            <div style={{ fontSize: "11pt", fontWeight: 600, color: "#6b7280", marginTop: "2pt" }}>Procurement Decision Record</div>
          </div>
          <div style={{ textAlign: "right", fontSize: "8pt", color: "#9ca3af", lineHeight: 1.7 }}>
            <div><strong style={{ color: "#374151" }}>Date:</strong> {new Date(data.processed_at || Date.now()).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</div>
            <div><strong style={{ color: "#374151" }}>Classification:</strong> Confidential</div>
            <div><strong style={{ color: "#374151" }}>System:</strong> ProcureTrace AI v1.0</div>
          </div>
        </div>

        {/* ─── DECISION BANNER ─── */}
        <div style={{ padding: "12pt 16pt", marginBottom: "20pt", border: `2px solid ${statusColor}`, backgroundColor: statusBg, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "7pt", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1pt", color: statusColor }}>Decision</div>
            <div style={{ fontSize: "14pt", fontWeight: 800, color: statusColor, marginTop: "2pt" }}>
              {rec?.status === "recommended" ? "RECOMMENDED" : "CANNOT PROCEED"}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "7pt", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1pt", color: "#6b7280" }}>Confidence</div>
            <div style={{ fontSize: "20pt", fontWeight: 800, color: "#111" }}>{data.confidence_score ?? "—"}%</div>
          </div>
        </div>

        {/* ─── 1. REQUEST SUMMARY ─── */}
        <div className="pdf-section">
          <div className="pdf-section-title">1. Request Summary</div>
          <div className="pdf-kv" style={{ fontSize: "9pt" }}>
            <span className="pdf-kv-label">Category</span>
            <span className="pdf-kv-value">{interp?.category_l1} › {interp?.category_l2}</span>
            <span className="pdf-kv-label">Quantity</span>
            <span className="pdf-kv-value">{interp?.quantity ?? "Not specified"}</span>
            <span className="pdf-kv-label">Budget</span>
            <span className="pdf-kv-value">{interp?.budget_amount ? `${interp.currency || "EUR"} ${Number(interp.budget_amount).toLocaleString("en", { minimumFractionDigits: 2 })}` : "Not specified"}</span>
            <span className="pdf-kv-label">Delivery</span>
            <span className="pdf-kv-value">{interp?.delivery_countries?.join(", ") || "Not specified"}</span>
            <span className="pdf-kv-label">Required By</span>
            <span className="pdf-kv-value">{interp?.required_by_date || "Not specified"} {interp?.days_until_required != null ? `(${interp.days_until_required} days)` : ""}</span>
            <span className="pdf-kv-label">Preferred Supplier</span>
            <span className="pdf-kv-value">{interp?.preferred_supplier_stated || "None"}</span>
          </div>
        </div>

        {/* ─── 2. VALIDATION ─── */}
        <div className="pdf-section">
          <div className="pdf-section-title">2. Validation</div>
          {data.validation?.issues?.length > 0 ? (
            <div>
              <div style={{ fontWeight: 700, color: "#991b1b", marginBottom: "6pt" }}>⚠ {data.validation.issues.length} issue(s) found</div>
              <table>
                <thead>
                  <tr style={{ backgroundColor: "#fef2f2", borderBottom: "1px solid #fca5a5" }}>
                    <th style={{ width: "60pt", fontSize: "8pt" }}>Severity</th>
                    <th style={{ fontSize: "8pt" }}>Issue</th>
                    <th style={{ fontSize: "8pt" }}>Required Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.validation.issues.map((iss: any, i: number) => (
                    <tr key={i} style={{ borderBottom: "1px solid #e5e7eb" }}>
                      <td style={{ fontWeight: 600, color: iss.severity === "critical" ? "#991b1b" : "#92400e", textTransform: "uppercase", fontSize: "8pt" }}>{iss.severity}</td>
                      <td>{iss.description}</td>
                      <td style={{ color: "#6b7280", fontStyle: "italic" }}>{iss.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ color: "#166534", fontWeight: 600, padding: "6pt 0" }}>✓ All validation checks passed</div>
          )}
        </div>

        {/* ─── 3. POLICY ─── */}
        <div className="pdf-section">
          <div className="pdf-section-title">3. Policy Evaluation</div>
          <div className="pdf-kv" style={{ fontSize: "9pt" }}>
            <span className="pdf-kv-label">Approval Tier</span>
            <span className="pdf-kv-value">Tier {data.policy_evaluation?.approval_tier?.tier || "N/A"}</span>
            <span className="pdf-kv-label">Quotes Required</span>
            <span className="pdf-kv-value">{data.policy_evaluation?.approval_tier?.quotes_required || "N/A"}</span>
            <span className="pdf-kv-label">Approver</span>
            <span className="pdf-kv-value">{data.policy_evaluation?.approval_tier?.approver || "N/A"}</span>
          </div>
        </div>

        <div className="page-break"></div>

        {/* ─── 4. SUPPLIER EVALUATION ─── */}
        <div className="pdf-section">
          <div className="pdf-section-title">4. Supplier Evaluation</div>
          <div style={{ fontSize: "7.5pt", color: "#9ca3af", marginBottom: "6pt" }}>Scoring: 35% Price · 25% Lead Time · 20% Quality · 15% Risk · 5% ESG</div>
          {data.supplier_shortlist?.length > 0 ? (
            <table>
              <thead>
                <tr style={{ backgroundColor: "#f3f4f6", borderBottom: "2px solid #9ca3af" }}>
                  <th style={{ width: "30pt", fontSize: "8pt" }}>#</th>
                  <th style={{ fontSize: "8pt" }}>Supplier</th>
                  <th style={{ fontSize: "8pt", textAlign: "right" }}>Unit Price</th>
                  <th style={{ fontSize: "8pt", textAlign: "right" }}>Total</th>
                  <th style={{ fontSize: "8pt", textAlign: "center" }}>Lead Time</th>
                  <th style={{ fontSize: "8pt", textAlign: "center" }}>Score</th>
                </tr>
              </thead>
              <tbody>
                {data.supplier_shortlist.map((s: any, i: number) => (
                  <tr key={i} style={{ borderBottom: "1px solid #e5e7eb", backgroundColor: i === 0 ? "#f0fdf4" : "transparent" }}>
                    <td style={{ fontWeight: 700 }}>{s.rank || i + 1}</td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{s.supplier_name}</span>
                      {s.preferred && <span style={{ fontSize: "7pt", color: "#2563eb", marginLeft: "4pt" }}> PREFERRED</span>}
                      {s.incumbent && <span style={{ fontSize: "7pt", color: "#7c3aed", marginLeft: "4pt" }}> INCUMBENT</span>}
                    </td>
                    <td style={{ textAlign: "right" }}>{s.unit_price} {interp?.currency}</td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>{Number(s.total_price).toLocaleString("en")} {interp?.currency}</td>
                    <td style={{ textAlign: "center" }}>{s.standard_lead_time_days}d / {s.expedited_lead_time_days}d</td>
                    <td style={{ textAlign: "center", fontWeight: 700, color: "#166534" }}>{s.composite_score_pct ?? s.composite_score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ color: "#991b1b", fontWeight: 600, padding: "6pt 0" }}>No eligible suppliers found</div>
          )}
        </div>

        {/* ─── 5. ESCALATIONS ─── */}
        {data.escalations?.length > 0 && (
          <div className="pdf-section">
            <div className="pdf-section-title">5. Escalations</div>
            <table>
              <thead>
                <tr style={{ backgroundColor: "#fef2f2", borderBottom: "1px solid #fca5a5" }}>
                  <th style={{ width: "50pt", fontSize: "8pt" }}>ID</th>
                  <th style={{ fontSize: "8pt" }}>Trigger</th>
                  <th style={{ fontSize: "8pt" }}>Escalate To</th>
                  <th style={{ width: "60pt", fontSize: "8pt" }}>Blocking</th>
                </tr>
              </thead>
              <tbody>
                {data.escalations.map((e: any, i: number) => (
                  <tr key={i} style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ fontWeight: 600 }}>{e.id}</td>
                    <td>{e.trigger}</td>
                    <td>{e.escalate_to}</td>
                    <td style={{ fontWeight: 700, color: e.blocking ? "#991b1b" : "#166534" }}>{e.blocking ? "YES" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── 6. AI RATIONALE ─── */}
        <div className="pdf-section">
          <div className="pdf-section-title">{data.escalations?.length > 0 ? "6" : "5"}. AI Decision Rationale</div>
          <div style={{ fontSize: "9pt", lineHeight: 1.6, padding: "10pt 12pt", backgroundColor: "#f9fafb", border: "1px solid #e5e7eb" }}>
            <div style={{ marginBottom: "8pt" }}>
              <strong>Status:</strong>{" "}
              <span style={{ fontWeight: 700, color: statusColor, textTransform: "uppercase" }}>
                {String(rec?.status).replace("_", " ")}
              </span>
              {rec?.is_auto_approved && <span style={{ marginLeft: "8pt", color: "#166534", fontSize: "8pt", fontWeight: 600 }}>✓ AUTO-APPROVED</span>}
            </div>
            <div>{rec?.rationale || rec?.reason || "No rationale provided"}</div>
            {rec?.key_reasons && (
              <div style={{ marginTop: "8pt" }}>
                <strong>Key factors:</strong>
                <ul style={{ margin: "4pt 0 0 16pt", padding: 0, listStyle: "disc" }}>
                  {rec.key_reasons.map((r: string, i: number) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* ─── AUDIT TRAIL ─── */}
        <div style={{ marginTop: "16pt", paddingTop: "8pt", borderTop: "1px solid #e5e7eb", fontSize: "7.5pt", color: "#9ca3af" }}>
          <div><strong>Policies:</strong> {data.audit_trail?.policies_checked?.join(", ")}</div>
          <div><strong>Data sources:</strong> {data.audit_trail?.data_sources_used?.join(", ")}</div>
          <div><strong>Inference applied:</strong> {data.audit_trail?.inference_applied ? "Yes" : "No"}</div>
        </div>

        {/* ─── FOOTER ─── */}
        <div style={{ marginTop: "24pt", borderTop: "2px solid #dc2626", paddingTop: "10pt", textAlign: "center", fontSize: "7pt", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "1pt" }}>
          <div>Generated by ProcureTrace AI — Confidential Internal Record</div>
          <div style={{ marginTop: "3pt" }}>Non-binding decision. Final authorization subject to human review.</div>
          <div style={{ marginTop: "3pt" }}>{new Date().toUTCString()}</div>
        </div>
      </div>
    </>
  );
}
