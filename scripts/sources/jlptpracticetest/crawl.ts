// 抓取 jlptpracticetest.com 的 N1/N2 场次页面到本地缓存（.cache/jlptpracticetest，已加入 .gitignore）。
// 该站 robots.txt 允许 /n1/ /n2/ 并建议 Crawl-delay: 1；这里每次请求间隔 1.5 秒。
// 用法：npm run crawl:jpt [-- --out <目录>]
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../..', import.meta.url).pathname;
const outIdx = process.argv.indexOf('--out');
const OUT = outIdx >= 0 ? process.argv[outIdx + 1] : join(ROOT, '.cache/jlptpracticetest');
const UA = 'Mozilla/5.0 (compatible; jlpt-atlas-research/0.1)';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  mkdirSync(OUT, { recursive: true });
  const sitemap = await (await fetch('https://www.jlptpracticetest.com/sitemap.xml', { headers: { 'User-Agent': UA } })).text();
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1])
    .filter((u) => /jlptpracticetest\.com\/n[12]\/\d{6}\/(vocabulary|grammar)$/.test(u));
  console.log(`目标页面 ${urls.length} 个 → ${OUT}`);
  for (const u of urls) {
    const name = `${u.split('jlptpracticetest.com/')[1].replace(/\//g, '_')}.html`;
    const path = join(OUT, name);
    if (existsSync(path) && statSync(path).size > 10000) continue;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(u, { headers: { 'User-Agent': UA } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        writeFileSync(path, await res.text());
        console.log('ok', name);
        break;
      } catch (e) {
        console.warn('err', name, (e as Error).message);
        await sleep(5000);
      }
    }
    await sleep(1500);
  }
}

main();
