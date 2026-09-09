// [check style] TEMP - Diagnostic helper for style flow tracking
// Marker: [check style] - Delete this file when diagnosis is complete.

const PREFIX = "[check style]";

function isStorageAvailable(): boolean {
  try {
    return typeof window !== "undefined" && Boolean(window.localStorage);
  } catch {
    return false;
  }
}

export function isCheckStyleEnabled(targetLayerCode?: string | null): boolean {
  try {
    if (typeof window === "undefined") return false;
    const storage = isStorageAvailable() ? window.localStorage : null;
    const forced = storage ? storage.getItem("check style") : null;
    if (forced === "0") return false;
    const enabled = forced === "1" || Boolean(import.meta.env?.DEV);
    if (!enabled) return false;

    if (targetLayerCode && storage) {
      const filter = storage.getItem("check style:layer");
      if (filter && filter.trim() && filter.trim() !== String(targetLayerCode).trim()) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

export function safeSnapshot(value: unknown, depth = 4): unknown {
  if (depth < 0) return "[Max Depth]";
  if (value === undefined) return "__UNDEFINED__";
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "__NAN__";
    if (!Number.isFinite(value)) return value > 0 ? "__+INFINITY__" : "__-INFINITY__";
    return value;
  }
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => safeSnapshot(item, depth - 1));
  }
  const out: Record<string, unknown> = {};
  const entries = Object.entries(value as Record<string, unknown>);
  for (const [k, v] of entries.slice(0, 100)) {
    out[k] = safeSnapshot(v, depth - 1);
  }
  return out;
}

export function checkStyleLog(tag: string, context: Record<string, unknown> = {}, level: "log" | "warn" | "error" = "log"): void {
  const layerCode = (context?.layerCode || context?.code || null) as string | null;
  if (!isCheckStyleEnabled(layerCode)) return;

  const timestamp = new Date().toISOString().slice(11, 23);
  const title = `${PREFIX}[admin][${tag}] @${timestamp}`;
  const payload = safeSnapshot(context);

  if (level === "error") {
    console.error(title, payload);
  } else if (level === "warn") {
    console.warn(title, payload);
  } else {
    console.log(title, payload);
  }
}

export default {
  isCheckStyleEnabled,
  safeSnapshot,
  checkStyleLog,
};