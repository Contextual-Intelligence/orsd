/**
 * FDA 510(k) — Re-export from clearance.ts
 *
 * The FDA calls them "510(k) Premarket Notifications" in the API.
 * We use a single connector for both.
 */
export { fetch510kClearances } from "./clearance.js";
