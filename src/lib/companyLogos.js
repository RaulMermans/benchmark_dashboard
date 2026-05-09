const COMPANY_LOGOS={focus:"/assets/logo-focus.svg",peer_a:"/assets/logo-peer-a.svg",peer_b:"/assets/logo-peer-b.svg",peer_c:"/assets/logo-peer-c.svg",peer_d:"/assets/logo-peer-d.svg",peer_e:"/assets/logo-peer-e.svg",peer_f:"/assets/logo-peer-f.svg",peer_g:"/assets/logo-peer-g.svg",market_average:"/assets/logo-market-average.svg"};
function normalizeCompanyId(companyId){return String(companyId??"").trim().toLowerCase();}
export function getCompanyLogoSrc(companyId){return COMPANY_LOGOS[normalizeCompanyId(companyId)]??"";}
