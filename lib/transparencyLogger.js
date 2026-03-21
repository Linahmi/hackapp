/**
 * Transparency Logger for EU AI Act (Art. 13) Compliance.
 * 
 * Captures metadata for every LLM interaction to ensure the "black box" 
 * remains auditable and transparent for regulators.
 */

const logs = [];

/**
 * Log an LLM interaction.
 * 
 * @param {string} component - The module making the call (e.g., 'IntakeAgent').
 * @param {object} metadata - Metadata including prompt, tokens, latency, etc.
 */
export function logLLMCall(component, metadata) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    component,
    ...metadata,
  };
  logs.push(logEntry);
  console.log(`[TransparencyLog] Captured ${component} call: ${metadata.tokens_total || 0} tokens`);
}

/**
 * Get all captured logs for the current audit trail.
 */
export function getTransparencyLogs() {
  return [...logs];
}

/**
 * Reset logs (usually at the start of a new pipeline run).
 */
export function resetTransparencyLogs() {
  logs.length = 0;
}
