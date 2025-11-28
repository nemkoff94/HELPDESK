// formatDate(dateString, opts) -> localized string using user's timezone
const DEFAULT_OPTIONS = {
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hour12: false,
};

export default function formatDate(dateString, options = {}) {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
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
