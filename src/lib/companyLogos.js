function normalizeCompanyId(companyId) {
  return String(companyId ?? "").trim().toLowerCase();
}

// Public demo uses initials instead of real brand logos.
// Keep this resolver for compatibility with existing components.
export function getCompanyLogoSrc(companyId) {
  normalizeCompanyId(companyId);
  return "";
}
