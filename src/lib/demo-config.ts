/**
 * Demo configuration — single source of truth for all simulation probabilities
 * and the Demo Mode flag. Change numbers here; nowhere else.
 */
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Consent auto-simulation probabilities (must sum to 1.0)
// ---------------------------------------------------------------------------
export const CONSENT_PROBABILITIES = {
  /** Fraction of auto-simulated consents that resolve as GRANTED */
  approve: 0.70,
  /** Fraction that resolve as DENIED */
  deny: 0.15,
  /** Fraction that resolve as EXPIRED (no response) */
  expire: 0.15,
} as const;

// ---------------------------------------------------------------------------
// Record fetch simulation parameters
// ---------------------------------------------------------------------------
/** Min/max seconds before a simulated facility responds (inclusive) */
export const RECORD_FETCH_DELAY_RANGE: [number, number] = [2, 8];

/** Fraction of facilities that time out (return no records) */
export const FACILITY_TIMEOUT_RATE = 0.10;

/** Min/max seconds before auto-consent resolves (inclusive) */
export const AUTO_CONSENT_DELAY_RANGE: [number, number] = [20, 90];

// ---------------------------------------------------------------------------
// Demo Mode — stored in data/demo-config.json so server-side logic can read it
// ---------------------------------------------------------------------------
const CONFIG_FILE = path.join(process.cwd(), "data", "demo-config.json");

interface DemoConfigFile {
  demoMode: boolean;
}

let memoryDemoConfig: DemoConfigFile | null = null;

function readConfigFile(): DemoConfigFile {
  if (memoryDemoConfig) return memoryDemoConfig;
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
    memoryDemoConfig = JSON.parse(raw) as DemoConfigFile;
    return memoryDemoConfig;
  } catch {
    memoryDemoConfig = { demoMode: false };
    return memoryDemoConfig;
  }
}

function writeConfigFile(data: DemoConfigFile) {
  memoryDemoConfig = data;
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    // Read-only filesystem in Vercel serverless environment
  }
}

/** Returns true when Demo Mode is enabled (disables all random delays/failures). */
export function isDemoMode(): boolean {
  return readConfigFile().demoMode;
}

/** Toggles Demo Mode and returns the new state. */
export function toggleDemoMode(): boolean {
  const current = readConfigFile();
  const next = { demoMode: !current.demoMode };
  writeConfigFile(next);
  return next.demoMode;
}

/** Sets Demo Mode to a specific value. */
export function setDemoMode(value: boolean): void {
  writeConfigFile({ demoMode: value });
}

