export { buildProfileViewModel } from "../framework/index.js";

export function getProfileHash(profilePrefix, companyId) {
  return `${profilePrefix}${encodeURIComponent(companyId)}`;
}
