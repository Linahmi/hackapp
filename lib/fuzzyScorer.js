/**
 * Mamdani-style Fuzzy Inference System for Supplier Suitability.
 * 
 * Provides a sophisticated scoring mechanism that handles "gray areas" 
 * by mapping crisp inputs (Price, Quality, ESG) into fuzzy membership sets.
 */

// ─── Membership Functions ─────────────────────────────────────────────────────

function trimf(x, a, b, c) {
  const left = (b === a) ? (x >= a ? 1 : 0) : (x - a) / (b - a);
  const right = (c === b) ? (x <= c ? 1 : 0) : (c - x) / (c - b);
  return Math.max(0, Math.min(left, right));
}

function trapmf(x, a, b, c, d) {
  const left = (b === a) ? (x >= a ? 1 : 0) : (x - a) / (b - a);
  const right = (d === c) ? (x <= d ? 1 : 0) : (d - x) / (d - c);
  return Math.max(0, Math.min(left, 1, right));
}

// ─── Fuzzification ────────────────────────────────────────────────────────────

/**
 * Price (inverted: higher x = cheaper)
 * 0 - 100 scale where 100 is "Very Cheap"
 */
function fuzzifyPrice(x) {
  return {
    expensive: trapmf(x, 0, 0, 20, 45),
    moderate: trimf(x, 30, 50, 70),
    cheap: trapmf(x, 55, 80, 100, 100),
  };
}

/**
 * Quality
 * 0 - 100 scale
 */
function fuzzifyQuality(x) {
  return {
    low: trapmf(x, 0, 0, 30, 50),
    medium: trimf(x, 40, 60, 80),
    high: trapmf(x, 70, 90, 100, 100),
  };
}

/**
 * Suitability (Output)
 * 0 - 100 scale
 */
const SUITABILITY_SETS = {
  poor: [0, 0, 25, 40],
  fair: [30, 45, 55, 70],
  good: [60, 75, 85, 100],
  excellent: [80, 95, 100, 100],
};

// ─── Inference Rules ──────────────────────────────────────────────────────────

/**
 * 1. IF Price is Expensive THEN Suitability is Poor
 * 2. IF Price is Moderate AND Quality is Low THEN Suitability is Fair
 * 3. IF Price is Moderate AND Quality is Medium THEN Suitability is Good
 * 4. IF Price is Cheap AND Quality is High THEN Suitability is Excellent
 * 5. IF Quality is Low THEN Suitability is Poor
 */
function applyRules(price, quality) {
  const activations = {
    poor: 0,
    fair: 0,
    good: 0,
    excellent: 0,
  };

  // Rule 1: Expensive -> Poor
  activations.poor = Math.max(activations.poor, price.expensive);

  // Rule 2: Moderate AND Low -> Fair
  activations.fair = Math.max(activations.fair, Math.min(price.moderate, quality.low));

  // Rule 3: Moderate AND Medium -> Good
  activations.good = Math.max(activations.good, Math.min(price.moderate, quality.medium));

  // Rule 4: Cheap AND High -> Excellent
  activations.excellent = Math.max(activations.excellent, Math.min(price.cheap, quality.high));

  // Rule 5: Quality Low -> Poor
  activations.poor = Math.max(activations.poor, quality.low);

  return activations;
}

// ─── Defuzzification (Centroid) ───────────────────────────────────────────────

function defuzzify(activations) {
  let numerator = 0;
  let denominator = 0;

  // Integrate over the output range 0-100 with steps of 2
  for (let x = 0; x <= 100; x += 2) {
    let membership = 0;
    
    // Aggregate the membership for this x across all activated output sets
    for (const [set, alpha] of Object.entries(activations)) {
      const [a, b, c, d] = SUITABILITY_SETS[set];
      const m = trapmf(x, a, b, c, d);
      membership = Math.max(membership, Math.min(alpha, m));
    }

    numerator += x * membership;
    denominator += membership;
  }

  return denominator === 0 ? 50 : numerator / denominator;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compute the fuzzy suitability score for a supplier.
 * 
 * @param {number} rawPriceScore - Normalized price score (0-100, higher is better/cheaper).
 * @param {number} rawQualityScore - Raw quality score (0-100).
 * @returns {number} Defuzzified suitability score (0-100).
 */
export function computeFuzzyScore(rawPriceScore, rawQualityScore) {
  const p = fuzzifyPrice(rawPriceScore);
  const q = fuzzifyQuality(rawQualityScore);
  const activations = applyRules(p, q);
  return defuzzify(activations);
}
