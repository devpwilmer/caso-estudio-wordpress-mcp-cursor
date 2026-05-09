/**
 * URLs que no deben tratarse como spam (origen del sitio y servicios habituales).
 * Define WP_SITE_HOST en .env con el host de tu WordPress (sin https://).
 */
export function isTrustedOriginHref(href) {
  if (!href || /^mailto:|^tel:|^#|^javascript:/i.test(href)) return true;
  const h = href.toLowerCase();
  const site = (process.env.WP_SITE_HOST || "")
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/^https?:\/\//, "")
    .split("/")[0];
  if (site && h.includes(site)) return true;
  if (h.includes("wa.me")) return true;
  if (h.includes("fonts.googleapis.com")) return true;
  if (h.includes("gmpg.org")) return true;
  return false;
}
