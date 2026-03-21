/**
 * Verification Script for ProcureTrace Fuzzy Logic Scorer.
 */
import { computeFuzzyScore } from './lib/fuzzyScorer.js';

const testScenarios = [
  { price: 90, quality: 90, label: "Cheap and High Quality (Expect High Score)" },
  { price: 10, quality: 10, label: "Expensive and Low Quality (Expect Low Score)" },
  { price: 50, quality: 50, label: "Moderate and Medium Quality (Expect Mid Score)" },
  { price: 10, quality: 90, label: "Expensive but High Quality (Expect Poor/Fair)" },
  { price: 90, quality: 10, label: "Cheap but Low Quality (Expect Poor)" },
];

console.log("─── ProcureTrace Fuzzy Scorer Verification ───");

testScenarios.forEach(s => {
  const score = computeFuzzyScore(s.price, s.quality);
  console.log(`[Test] ${s.label.padEnd(50)}: Resulting Score = ${score.toFixed(2)}`);
});

console.log("\n─── Verification Complete ───");
