import { checkApprovalTier, checkPreferredSupplier } from './lib/policyEngine.js'
import { scoreSuppliers } from './lib/supplierScorer.js'
import { buildEscalations } from './lib/escalationRouter.js'
import { computeConfidence } from './lib/confidenceScorer.js'

console.log('=== TEST 1: Approval Tier ===')
console.log(checkApprovalTier(35000, 'EUR'))
// Expected: { tier: 2, quotes_required: 2, approver: 'Business + Procurement' or similar }

console.log('=== TEST 2: Supplier Scoring ===')
console.log(scoreSuppliers('IT', 'Docking Stations', ['DE'], 240, 'EUR'))
// Expected: array of 3 ranked suppliers with composite_score, unit_price, lead times

console.log('=== TEST 3: Escalation Router ===')
console.log(buildEscalations([
  { rule: 'ER-001', reason: 'Budget insufficient', blocking: true },
  { rule: 'ER-002', reason: 'Supplier restricted', blocking: true },
  { rule: 'ER-004', reason: 'No compliant supplier', blocking: true }
]))
// Expected: 3 objects with correct escalate_to targets

console.log('=== TEST 4: Confidence Score ===')
console.log(computeConfidence({
  issues: [{ severity: 'critical' }],
  suppliers: [{ composite_score: 0.8 }, { composite_score: 0.75 }],
  preferredAvailable: true,
  historicalMatch: false
}))
// Expected: number between 0-100

console.log('=== TEST 5: Preferred Supplier ===')
console.log(checkPreferredSupplier('Dell Enterprise Europe', 'Docking Stations', 'DE'))
// Expected: object with is_preferred, is_restricted, covers_delivery_country
