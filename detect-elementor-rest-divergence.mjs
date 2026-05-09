import "dotenv/config";

const BASE = (process.env.WP_BASE_URL || "").replace(/\/$/, "");
const auth =
  "Basic " +
  Buffer.from(
    `${process.env.WP_USERNAME || ""}:${process.env.WP_APP_PASSWORD || ""}`
  ).toString("base64");

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  if (!id) throw new Error("No static front page. Set WP_FRONT_PAGE_ID.");
  return id;
}

const home = await fetch(`${BASE}/?cb=${Date.now()}`, {
  headers: { "Cache-Control": "no-cache" }
}).then((r) => r.text());

const pageId = await frontPageId();
const r = await fetch(
  `${BASE}/wp-json/wp/v2/pages/${pageId}?context=edit&_fields=meta`,
  { headers: { Authorization: auth } }
);
const j = await r.json();
const ed = j.meta._elementor_data || "";

const rawProbes = process.env.SPAM_PROBE_SUBSTRINGS || "casino,left:-9999";
const probes = rawProbes
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const checks = probes.map((p) => {
  const safe = escapeRe(p);
  return [p, new RegExp(safe, "i")];
});

const report = { pageId, homepage: {}, rest_meta: {} };
for (const [name, re] of checks) {
  report.homepage[name] = re.test(home);
  report.rest_meta[name] = re.test(ed);
}

console.log(JSON.stringify(report, null, 2));

const firstProbe = probes[0];
if (
  firstProbe &&
  report.homepage[firstProbe] &&
  !report.rest_meta[firstProbe]
) {
  console.error(
    "\n>>> DIVERGENCIA: la home pública contiene marcadores que NO aparecen en meta._elementor_data vía REST.\n" +
      "    Suele indicar: caché, meta distinta en BD, o inyección en the_content.\n" +
      "    Purgar caché y revisar BD/plugins.\n"
  );
}
