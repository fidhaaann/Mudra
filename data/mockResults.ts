import { EventResult } from "@/types/result";

/**
 * Verified competition results.
 * Starts empty until real results are submitted via Google Sheets / API.
 */
export const RECORDED_RESULTS: Record<string, EventResult> = {};
