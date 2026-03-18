// lib/escalationRouter.js

export function buildEscalations(triggers) {
  const map = {
    "ER-001": { escalate_to: "Requester", action: "Request clarification or additional budget", blocking: true },
    "ER-002": { escalate_to: "Procurement Manager", action: "Review and approve exception", blocking: true },
    "ER-003": { escalate_to: "Head of Strategic Sourcing", action: "Strategic review", blocking: true },
    "ER-004": { escalate_to: "Head of Category", action: "Category strategy review", blocking: true },
    "ER-005": { escalate_to: "Security/Compliance", action: "Security architecture sign-off", blocking: true },
    "ER-006": { escalate_to: "Sourcing Excellence Lead", action: "Sourcing capacity review", blocking: true },
    "ER-007": { escalate_to: "Marketing Governance Lead", action: "Brand safety governance review", blocking: true },
    "ER-008": { escalate_to: "Regional Compliance Lead", action: "Compliance clearance required", blocking: true }
  };
  
  return triggers.map((t, index) => {
    const info = map[t.rule];
    return {
      id: `ESC-00${index + 1}`,
      rule: t.rule,
      trigger: t.trigger || "System generated trigger",
      escalate_to: info?.escalate_to || "Admin",
      action: info?.action || "Review required",
      blocking: info?.blocking !== undefined ? info.blocking : true
    };
  });
}
