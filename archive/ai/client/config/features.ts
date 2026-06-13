/**
 * Master AI feature flag.
 *
 * Set `VITE_ENABLE_AI=false` in .env to disable all AI-powered features
 * across the entire UI. The designer canvas, manual drawing, and export
 * remain fully functional.
 *
 * To re-enable AI: set VITE_ENABLE_AI=true (or remove the line — default is true).
 */
export const ENABLE_AI = false; // import.meta.env.VITE_ENABLE_AI !== 'false';
