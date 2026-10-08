/**
 * Compact, schema-tolerant discovery for Intervals.icu activity data.
 *
 * Intervals adds activity fields and sensor streams over time. Keep new numeric performance data
 * visible to the Coach without forwarding raw samples, free text, identifiers, or route traces.
 */

const MAX_ACTIVITY_FIELDS = 256;
const LOCATION_STREAM = /(latlng|latitude|longitude|location|position|coordinates|gps|polyline|map)/i;
const PRIVATE_FIELD_SEGMENT =
  /^(id|athlete|owner|user|upload|external|calendar|event|workout|lat|lng|latlng|latitude|longitude|location|position|coordinates|gps|map|polyline)$/i;

function rounded(value) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toPrecision(7));
}

function numericSummary(values) {
  const numbers = (Array.isArray(values) ? values : [])
    .filter((value) => value != null && value !== "")
    .map(Number)
    .filter(Number.isFinite);
  if (!numbers.length) return null;
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  for (const value of numbers) {
    sum += value;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return {
    samples: numbers.length,
    start: rounded(numbers[0]),
    end: rounded(numbers[numbers.length - 1]),
    average: rounded(sum / numbers.length),
    min: rounded(min),
    max: rounded(max),
  };
}

function safePath(path) {
  return path
    .split(/[._-]/)
    .filter(Boolean)
    .every((segment) => !PRIVATE_FIELD_SEGMENT.test(segment));
}

/**
 * Return every bounded numeric/boolean activity field, flattening small nested objects. Strings
 * are deliberately excluded because descriptions and notes may contain arbitrary personal text.
 */
function discoverActivityFields(activity, { maxFields = MAX_ACTIVITY_FIELDS } = {}) {
  const values = {};
  let discovered = 0;
  let truncated = false;

  const visit = (value, path, depth) => {
    if (!path || !safePath(path) || value == null || value === "") return;
    if (discovered >= maxFields) {
      truncated = true;
      return;
    }
    if (typeof value === "boolean") {
      values[path] = value;
      discovered += 1;
      return;
    }
    if (typeof value === "number") {
      if (Number.isFinite(value)) {
        values[path] = rounded(value);
        discovered += 1;
      }
      return;
    }
    if (Array.isArray(value)) {
      const summary = numericSummary(value);
      if (summary) {
        values[path] = summary;
        discovered += 1;
      }
      return;
    }
    if (typeof value !== "object" || depth >= 2) return;
    for (const key of Object.keys(value).sort()) {
      if (!/^[A-Za-z0-9_-]{1,80}$/.test(key)) continue;
      visit(value[key], path ? `${path}.${key}` : key, depth + 1);
    }
  };

  if (activity && typeof activity === "object" && !Array.isArray(activity)) {
    for (const key of Object.keys(activity).sort()) {
      if (!/^[A-Za-z0-9_-]{1,80}$/.test(key)) continue;
      visit(activity[key], key, 0);
    }
  }
  return { values, truncated };
}

function streamEntries(streams) {
  if (Array.isArray(streams)) {
    return streams
      .map((stream) => ({
        type: String(stream?.type || ""),
        data: Array.isArray(stream?.data) ? stream.data : [],
        unit: typeof stream?.units === "string"
          ? stream.units
          : typeof stream?.unit === "string"
            ? stream.unit
            : null,
      }))
      .filter((stream) => stream.type);
  }
  if (!streams || typeof streams !== "object") return [];
  return Object.entries(streams).map(([type, stream]) => ({
    type,
    data: Array.isArray(stream) ? stream : Array.isArray(stream?.data) ? stream.data : [],
    unit: typeof stream?.units === "string"
      ? stream.units
      : typeof stream?.unit === "string"
        ? stream.unit
        : null,
  }));
}

function valuesInTimeRange(values, time, fromSeconds, toSeconds) {
  if (!Array.isArray(values)) return [];
  if (!Array.isArray(time) || !time.length || (fromSeconds == null && toSeconds == null)) return values;
  const from = Math.max(0, Number(fromSeconds) || 0);
  const to = Number.isFinite(Number(toSeconds)) ? Number(toSeconds) : Infinity;
  const selected = [];
  const count = Math.min(values.length, time.length);
  for (let i = 0; i < count; i++) {
    const second = Number(time[i]);
    if (Number.isFinite(second) && second >= from && second < to) selected.push(values[i]);
  }
  return selected;
}

/**
 * Summarize every numeric stream that does not already have a richer normalized metric. Route
 * coordinates are catalogued as redacted but never sent to the model.
 */
function discoverStreamSummaries(
  streams,
  { time = [], exclude = [], fromSeconds = null, toSeconds = null } = {}
) {
  const excluded = new Set(exclude);
  const summaries = {};
  const available = [];
  const redacted = [];

  for (const stream of streamEntries(streams).sort((a, b) => a.type.localeCompare(b.type))) {
    const type = stream.type;
    if (!/^[A-Za-z0-9_:-]{1,80}$/.test(type)) continue;
    available.push(type);
    if (LOCATION_STREAM.test(type)) {
      redacted.push(type);
      continue;
    }
    if (excluded.has(type) || type === "time") continue;
    const summary = numericSummary(
      valuesInTimeRange(stream.data, time, fromSeconds, toSeconds)
    );
    if (!summary) continue;
    summaries[type] = {
      ...summary,
      ...(stream.unit && stream.unit.length <= 24 ? { unit: stream.unit } : {}),
    };
  }

  return {
    available: [...new Set(available)],
    summaries,
    redacted: [...new Set(redacted)],
  };
}

module.exports = {
  MAX_ACTIVITY_FIELDS,
  numericSummary,
  discoverActivityFields,
  discoverStreamSummaries,
};
