export const APP_LOCALE = "en-US";
export const APP_CURRENCY = "EUR";

export function formatAppDateTime(value) {
  if (!value) return "N/A";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";

  return date.toLocaleString(APP_LOCALE);
}
