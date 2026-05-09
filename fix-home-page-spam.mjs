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
    /babu88|mostbet|betify|pokies|pinup-casino|goodman-casino|gratogana|locowin|winunique|princeali|thepokies|casino-midas|malinacasino|casinofrumzi|casino-tropica|casino-spin-mama|casinos-gratogana|bizzocasino|hermes-casino|alexandercasino|fr-alexander|fr-betify|casinoextra|casinoslocowin|casinotropica|interacasino|gtamodding\.fr|slides\.com\/.*paysafecard|mycandylove\.com\/s2\/profile\/casino|bandcamp\.com\/album\/.*endorphina|topacio-cl|spacefortuna|king-chance\.fr|meulink\.fit|giveawayoftheday\.com\/forums|pixabay\.com\/users\/54589909|^https?:\/\/test\.com\/|theearlyhour\.com|localguidesconnect\.com|marmiton\.org\/forum|mecabricks\.com\/en\/forum|casino-my-empire|casinoextra-france|casinowinunique|gratogana-casino|pinup-casino-ni|princealicasino|goodman-casino\.de|gratorama-fr|casinoextra|interacasino|princealicasinofr/i.test(
      h
    ) || /casino/i.test(h)
  );
}

async function frontPageId() {
  if (process.env.WP_FRONT_PAGE_ID)
    return parseInt(process.env.WP_FRONT_PAGE_ID, 10);
  const r = await fetch(`${BASE}/wp-json/wp/v2/settings`, {
    headers: { Authorization: auth }
  });
  if (!r.ok) throw new Error("settings " + r.status);
  const j = await r.json();
  const id = j.page_on_front;
  if (!id) throw new Error("No static front page (page_on_front). Set WP_FRONT_PAGE_ID.");
  return id;
}

async function main() {
  const id = await frontPageId();
  const probe = (process.env.SPAM_PROBE || "casino").toLowerCase();

  const r = await fetch(`${BASE}/wp-json/wp/v2/pages/${id}?context=edit`, {
    headers: { Authorization: auth }
  });
  const pg = await r.json();
  const rendered = pg.content?.rendered || "";
  console.log("before_probe", probe, rendered.toLowerCase().includes(probe), "len", rendered.length);

  const $ = load(rendered, { decodeEntities: false });
  let removed = 0;
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (isSpamHref(href)) {
      $(el).replaceWith($(el).html() || "");
      removed++;
    }
  });
  const cleaned = $.root().html() || "";

  console.log("after_strip_probe", probe, cleaned.toLowerCase().includes(probe), "removed", removed);

  const patch = await fetch(`${BASE}/wp-json/wp/v2/pages/${id}`, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      content: cleaned
    })
  });
  const pt = await patch.text();
  console.log("patch_status", patch.status, pt.slice(0, 200));

  const r2 = await fetch(`${BASE}/wp-json/wp/v2/pages/${id}?context=edit`, {
    headers: { Authorization: auth }
  });
  const pg2 = await r2.json();
  console.log(
    "after_patch_probe",
    probe,
    (pg2.content?.rendered || "").toLowerCase().includes(probe)
  );
}

main();
