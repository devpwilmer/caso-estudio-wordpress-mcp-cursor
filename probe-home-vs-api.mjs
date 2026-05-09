import "dotenv/config";

const BASE = (process.env.WP_BASE_URL || "").replace(/\/$/, "");
const auth =
  "Basic " +
  Buffer.from(
    `${process.env.WP_USERNAME || ""}:${process.env.WP_APP_PASSWORD || ""}`
  ).toString("base64");

const marker = process.env.COMPARE_HTML_MARKER;
if (!marker) {
  console.error(
    "Define COMPARE_HTML_MARKER en .env: una cadena corta que exista en home y en el HTML del post (ej. un cierre de </li> único)."
  );
  process.exit(1);
}

const probe = (process.env.SPAM_PROBE || "casino").toLowerCase();

async function frontPageId() {
  if (process.env.WP_FRONT_PAGE_ID)
    return parseInt(process.env.WP_FRONT_PAGE_ID, 10);
  const r = await fetch(`${BASE}/wp-json/wp/v2/settings`, {
    headers: { Authorization: auth }
  });
  if (!r.ok) throw new Error("settings " + r.status);
  const j = await r.json();
  const id = j.page_on_front;
  if (!id) throw new Error("Set WP_FRONT_PAGE_ID or configure a static front page.");
  return id;
}

const home = await fetch(`${BASE}/?cb=${Date.now()}`, {
  headers: { "Cache-Control": "no-cache" }
}).then((r) => r.text());

const id = await frontPageId();
const api = await fetch(`${BASE}/wp-json/wp/v2/pages/${id}?context=edit`, {
  headers: { Authorization: auth }
}).then((r) => r.json());

const raw = api.content.raw || "";

const hi = home.indexOf(marker);
const ai = raw.indexOf(marker);

const hasProbe = (chunk) => chunk.toLowerCase().includes(probe);

console.log(
  "home idx",
  hi,
  "has probe after marker",
  hi >= 0 && hasProbe(home.slice(hi, hi + 500))
);
console.log(
  "api raw idx",
  ai,
  "has probe after marker",
  ai >= 0 && hasProbe(raw.slice(ai, ai + 500))
);

if (hi >= 0) console.log("HOME snippet:\n", home.slice(hi, hi + 450));
if (ai >= 0) console.log("RAW snippet:\n", raw.slice(ai, ai + 450));
