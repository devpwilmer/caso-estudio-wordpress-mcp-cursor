import "dotenv/config";

const BASE = (process.env.WP_BASE_URL || "").replace(/\/$/, "");
const auth =
  "Basic " +
  Buffer.from(
    `${process.env.WP_USERNAME || ""}:${process.env.WP_APP_PASSWORD || ""}`
  ).toString("base64");

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
  if (!id) throw new Error("Set WP_FRONT_PAGE_ID or static front page.");
  return id;
}

const pageId = await frontPageId();
const r = await fetch(
  `${BASE}/wp-json/wp/v2/pages/${pageId}?context=edit&_fields=meta`,
  { headers: { Authorization: auth } }
);
const t = await r.text();
console.log("probe in raw body", t.toLowerCase().includes(probe));

const j = JSON.parse(t);
const ed = j.meta._elementor_data || "";
const parsed = JSON.parse(ed);
const dump = JSON.stringify(parsed);
console.log("probe after JSON roundtrip", dump.toLowerCase().includes(probe));
