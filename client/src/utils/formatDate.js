// formatDate(dateString, opts) -> localized string using user's timezone
const DEFAULT_OPTIONS = {
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hour12: false,
};

export default function formatDate(dateString, options = {}) {
  if (!dateString) return '';
  try {
    // Normalize common DB datetime formats to an ISO UTC string so parsing is consistent across browsers.
    // Many backends store timestamps as 'YYYY-MM-DD HH:MM:SS' (UTC). `new Date('YYYY-MM-DD HH:MM:SS')`
    // can be parsed as local time in some browsers, producing incorrect offsets (e.g. 3 hours).
    // Detect bare date/time strings and convert to 'YYYY-MM-DDTHH:MM:SSZ' (explicit UTC) before parsing.
    let normalized = dateString;
    // Match patterns like '2025-11-28 12:34:56' or '2025-11-28T12:34:56' without timezone info
    const bareLocalPattern = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;
    const hasTZ = /([zZ]|[+-]\d{2}:?\d{2})$/;
    if (typeof dateString === 'string' && bareLocalPattern.test(dateString) && !hasTZ.test(dateString)) {
      normalized = dateString.replace(' ', 'T') + 'Z';
    }
    const d = new Date(normalized);
    const tz = (Intl && Intl.DateTimeFormat && Intl.DateTimeFormat().resolvedOptions && Intl.DateTimeFormat().resolvedOptions().timeZone) || 'UTC';
    // If caller provided explicit options, use them as-is (plus timezone).
    // Otherwise fall back to DEFAULT_OPTIONS which include time components.
    const opts = Object.keys(options || {}).length ? { ...options, timeZone: tz } : { ...DEFAULT_OPTIONS, timeZone: tz };
    const formatter = new Intl.DateTimeFormat(navigator.language || 'ru-RU', opts);
    return formatter.format(d);
  } catch (e) {
    return dateString;
  }
}
