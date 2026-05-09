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
    /babu88|mostbet|betify|pokies|pinup-casino|goodman-casino|gratogana|locowin|winunique|princeali|thepokies|casino-midas|malinacasino|casinofrumzi|casino-tropica|casino-spin-mama|casinos-gratogana|bizzocasino|hermes-casino|alexandercasino|fr-alexander|fr-betify|casinoextra|casinoslocowin|casinotropica|interacasino|gtamodding\.fr|slides\.com\/.*paysafecard|mycandylove\.com\/s2\/profile\/casino|bandcamp\.com\/album\/.*endorphina|topacio-cl|spacefortuna|king-chance\.fr|meulink\.fit|giveawayoftheday\.com\/forums|pixabay\.com\/users\/54589909|^https?:\/\/test\.com\/|theearlyhour\.com|localguidesconnect\.com|marmiton\.org\/forum|mecabricks\.com\/en\/forum|casino-my-empire|casinoextra-france|casinowinunique|gratogana-casino|pinup-casino-ni|princealicasino|goodman-casino\.de|hermes-casino\.net|only.?spins|spin.?monkey|my.?empire|locowin|winunique|tropica|frumzi|malina|midas\.net|midas\.app/i.test(
      h
    ) || /casino/i.test(h)
  );
}

function stripSpamAnchors(html) {
  if (!html) return { html: "", removed: 0 };
  const $ = load(html, { decodeEntities: false });
  let removed = 0;
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (isSpamHref(href)) {
      const inner = $(el).html() || "";
      $(el).replaceWith(inner);
      removed++;
    }
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
      removed++;
    }
  });
  let out = $.root().html() || "";
  out = out.replace(
    /https?:\/\/[^\s"'<>]+(?:babu88|casino|betify|mostbet|pokies)[^\s"'<>]*/gi,
    ""
  );
  return { html: out, removed };
}

function wrapLikeRaw(fragment, raw) {
  if (!raw || !/^\s*<html/i.test(raw)) return fragment;
  return `<html><head></head><body>${fragment}</body></html>`;
}

async function fetchPagesEdit() {
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

async function patchPageContent(id, contentRaw) {
  const r = await fetch(`${BASE}/wp-json/wp/v2/pages/${id}`, {
    method: "PATCH",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ content: contentRaw })
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`PATCH ${id} ${r.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

async function main() {
  const pages = await fetchPagesEdit();
  const report = [];

  for (const pg of pages) {
    const raw = pg.content?.raw ?? "";
    const rendered = pg.content?.rendered || "";
    const fromRendered = stripSpamAnchors(rendered);
    const fromRaw = stripSpamAnchors(raw);

    let toSave = null;
    let reason = "";
    if (fromRendered.removed > 0) {
      toSave = wrapLikeRaw(fromRendered.html, raw);
      reason = `rendered (${fromRendered.removed})`;
    } else if (fromRaw.removed > 0) {
      toSave = fromRaw.html;
      reason = `raw (${fromRaw.removed})`;
    }

    if (!toSave) continue;

    await patchPageContent(pg.id, toSave);
    report.push({
      id: pg.id,
      title: pg.title?.rendered,
      reason
    });
  }

  console.log(JSON.stringify({ pages_updated: report.length, details: report }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
