import "dotenv/config";

const BASE = (process.env.WP_BASE_URL || "").replace(/\/$/, "");
const probe = process.env.SPAM_PROBE || "casino";

const r = await fetch(`${BASE}/?cb=${Date.now()}`);
const t = await r.text();
const i = t.toLowerCase().indexOf(probe.toLowerCase());
console.log("probe", probe, "idx", i);
if (i >= 0) {
  console.log(t.slice(Math.max(0, i - 400), i + 250));
}
