import "dotenv/config";

const BASE = (process.env.WP_BASE_URL || "").replace(/\/$/, "");
const auth =
  "Basic " +
  Buffer.from(
    `${process.env.WP_USERNAME || ""}:${process.env.WP_APP_PASSWORD || ""}`
  ).toString("base64");

const SPAM_HINT =
  /babu88|mostbet|casino|betify|pokies|pay\s*safecard|jackpot|slot[s]?|\.bet\/|wett|affiliate|pinup|1xbet|melbet|bet365/i;

function extractUrls(html) {
  const out = new Set();
  if (!html) return out;
  const re = /href\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) out.add(m[1]);
  return out;
}

function externalOnly(urls) {
  const siteHost = new URL(BASE).hostname.replace(/^www\./, "");
  return [...urls].filter((u) => {
    if (!/^https?:\/\//i.test(u)) return false;
    try {
      const h = new URL(u).hostname.replace(/^www\./, "");
      return h !== siteHost;
    } catch {
      return false;
    }
  });
}

async function fetchHomeHtml() {
  const r = await fetch(`${BASE}/`, { redirect: "follow" });
  return await r.text();
}

async function main() {
  const report = {
    homepage_external: [],
    homepage_suspicious: [],
    posts_with_spam_links: [],
    pages_with_spam_links: [],
    note:
      "Enlaces en widgets/menús/bloques del tema pueden no estar en el contenido del post."
  };

  const homeHtml = await fetchHomeHtml();
  const homeExt = externalOnly(extractUrls(homeHtml)).sort();
  report.homepage_external = homeExt;
  report.homepage_suspicious = homeExt.filter((u) => SPAM_HINT.test(u));

  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const path = `/posts?per_page=100&page=${page}&status=publish,draft&_fields=id,title,link,content`;
    const listRes = await fetch(`${BASE}/wp-json/wp/v2${path}`, {
      headers: { Authorization: auth }
    });
    totalPages = Number(listRes.headers.get("x-wp-totalpages") || "1");
    const posts = await listRes.json();
    if (!Array.isArray(posts)) break;
    for (const post of posts) {
      const html = post.content?.rendered || "";
      const ext = externalOnly(extractUrls(html));
      const susp = ext.filter((u) => SPAM_HINT.test(u));
      if (susp.length > 0) {
        report.posts_with_spam_links.push({
          id: post.id,
          title: post.title?.rendered,
          link: post.link,
          suspicious_hrefs: susp
        });
      }
    }
    page++;
  }

  page = 1;
  totalPages = 1;
  while (page <= totalPages) {
    const listRes = await fetch(
      `${BASE}/wp-json/wp/v2/pages?per_page=100&page=${page}&_fields=id,title,link,content`,
      { headers: { Authorization: auth } }
    );
    totalPages = Number(listRes.headers.get("x-wp-totalpages") || "1");
    const pages = await listRes.json();
    if (!Array.isArray(pages)) break;
    for (const pg of pages) {
      const html = pg.content?.rendered || "";
      const ext = externalOnly(extractUrls(html));
      const susp = ext.filter((u) => SPAM_HINT.test(u));
      if (susp.length > 0) {
        report.pages_with_spam_links.push({
          id: pg.id,
          title: pg.title?.rendered,
          link: pg.link,
          suspicious_hrefs: susp
        });
      }
    }
    page++;
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
