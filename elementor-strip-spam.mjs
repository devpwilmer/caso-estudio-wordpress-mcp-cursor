import "dotenv/config";
import { load } from "cheerio";
import { isTrustedOriginHref } from "./site-allowlist.mjs";

const BASE = (process.env.WP_BASE_URL || "").replace(/\/$/, "");
const auth =
  "Basic " +
  Buffer.from(
    `${process.env.WP_USERNAME || ""}:${process.env.WP_APP_PASSWORD || ""}`
  ).toString("base64");

function isSpamHref(href) {
  if (!href || /^mailto:|^tel:|^#|^javascript:/i.test(href)) return false;
  if (isTrustedOriginHref(href)) return false;
  const h = href.toLowerCase();

  return (
    /babu88|mostbet|betify|pokies|pinup-casino|goodman-casino|gratogana|locowin|winunique|princeali|thepokies|casino-midas|malinacasino|casinofrumzi|casino-tropica|casino-spin-mama|casinos-gratogana|bizzocasino|hermes-casino|alexandercasino|fr-alexander|fr-betify|casinoextra|casinoslocowin|casinotropica|interacasino|gtamodding\.fr|slides\.com\/.*paysafecard|mycandylove\.com\/s2\/profile\/casino|bandcamp\.com\/album\/.*endorphina|topacio-cl|spacefortuna|king-chance\.fr|meulink\.fit|giveawayoftheday\.com\/forums|pixabay\.com\/users\/54589909|^https?:\/\/test\.com\/|theearlyhour\.com|localguidesconnect\.com|marmiton\.org\/forum|mecabricks\.com\/en\/forum|casino-my-empire|casinoextra-france|casinowinunique|gratogana-casino|pinup-casino-ni|princealicasino|goodman-casino\.de|gratorama-fr|chapellederonchamp\.fr|meulink\.fit|king-chance/i.test(
      h
    ) || /casino/i.test(h)
  );
}

function stripSpamHtml(html) {
  if (!html || typeof html !== "string") return html;
  const $ = load(html, { decodeEntities: false });
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (isSpamHref(href)) $(el).replaceWith($(el).html() || "");
  });
  $("div[style]").each((_, el) => {
    const st = ($(el).attr("style") || "").toLowerCase();
    if (
      st.includes("overflow") &&
      st.includes("height") &&
      st.includes("1px") &&
      st.includes("absolute") &&
      /left:\s*-\d{3,}px/.test(st)
    ) {
      $(el).remove();
    }
  });
  let out = $.root().html() || "";
  out = out.replace(
    /https?:\/\/[^\s"'<>]+(?:babu88|casino|betify|mostbet|pokies)[^\s"'<>]*/gi,
    ""
  );
  return out;
}

function deepClean(obj, stats) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") {
    const t = obj.trim();
    if (t.startsWith("{") || t.startsWith("[")) {
      try {
        const parsed = JSON.parse(obj);
        const cleaned = deepClean(parsed, stats);
        return JSON.stringify(cleaned);
      } catch {
        /* fallthrough */
      }
    }
    if (obj.includes("<") && obj.includes(">")) {
      const next = stripSpamHtml(obj);
      if (next !== obj) stats.htmlBlocks++;
      return next;
    }
    if (/^https?:\/\//i.test(t) && isSpamHref(t)) {
      stats.plainUrls++;
      return "";
    }
    return obj.replace(/https?:\/\/[^\s"'<>()\]]+/gi, (url) =>
      isSpamHref(url.replace(/[.,);]+$/, "")) ? "" : url
    );
  }
  if (Array.isArray(obj)) return obj.map((x) => deepClean(x, stats));
  if (typeof obj === "object") {
    const out = { ...obj };
    if (typeof out.url === "string" && isSpamHref(out.url)) {
      out.url = "";
      stats.urlFields++;
    }
    if (out.link && typeof out.link === "object" && typeof out.link.url === "string") {
      if (isSpamHref(out.link.url)) {
        out.link = { ...out.link, url: "" };
        stats.urlFields++;
      }
    }
    for (const k of Object.keys(out)) {
      if (k === "url" && typeof out[k] === "string") continue;
      if (k === "link" && typeof out[k] === "object") continue;
      out[k] = deepClean(out[k], stats);
    }
    return out;
  }
  return obj;
}

async function fetchAllPages() {
  let page = 1;
  let totalPages = 1;
  const all = [];
  while (page <= totalPages) {
    const r = await fetch(
      `${BASE}/wp-json/wp/v2/pages?per_page=100&page=${page}&context=edit`,
      { headers: { Authorization: auth } }
    );
    if (!r.ok) throw new Error("list pages " + r.status);
    totalPages = Number(r.headers.get("x-wp-totalpages") || "1");
    all.push(...(await r.json()));
    page++;
  }
  return all;
}

async function main() {
  const pages = await fetchAllPages();
  const report = [];

  for (const pg of pages) {
    const raw = pg.meta?._elementor_data;
    if (!raw || typeof raw !== "string") continue;
    if (!/babu88|casino|mostbet|betify|pokies|midas|malina|frumzi/i.test(raw))
      continue;

    const stats = { htmlBlocks: 0, plainUrls: 0, urlFields: 0 };
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error("JSON parse fail page", pg.id, e.message);
      continue;
    }
    const cleaned = deepClean(parsed, stats);
    const newJson = JSON.stringify(cleaned);
    if (newJson === raw) continue;

    const patch = await fetch(`${BASE}/wp-json/wp/v2/pages/${pg.id}`, {
      method: "PATCH",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        meta: {
          _elementor_data: newJson
        }
      })
    });
    const txt = await patch.text();
    if (!patch.ok) {
      report.push({
        id: pg.id,
        title: pg.title?.rendered,
        error: patch.status,
        body: txt.slice(0, 300)
      });
      continue;
    }
    report.push({
      id: pg.id,
      title: pg.title?.rendered,
      ok: true,
      stats
    });
  }

  console.log(JSON.stringify({ updated: report.filter((r) => r.ok).length, report }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
