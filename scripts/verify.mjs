// 検証スクリプト：node scripts/verify.mjs
// 小さな静的サーバーを内蔵し、Playwright(Chrome)で全ページ・3幅を巡回する。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(ROOT, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });
const PORT = 4173, BASE = `http://127.0.0.1:${PORT}/`;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8' };

const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, BASE).pathname);
  let f = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(PORT, '127.0.0.1');

const results = [], consoleErrors = [], shots = [], externalRequests = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  -> ' + detail : '')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WIDTHS = [375, 768, 1280];
const HEIGHT = { 375: 740, 768: 1024, 1280: 800 };

let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
} catch (e) {
  console.error('Chrome を起動できませんでした:', e.message); server.close(); process.exit(2);
}

async function open(w, url, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: HEIGHT[w] }, reducedMotion: opts.reduced ? 'reduce' : 'no-preference', locale: 'ja-JP', deviceScaleFactor: 1 });
  await ctx.addInitScript(() => {
    window.__ac = 0;
    for (const k of ['AudioContext', 'webkitAudioContext']) {
      const Orig = window[k]; if (!Orig) continue;
      window[k] = function (...a) { window.__ac++; return new Orig(...a); }; window[k].prototype = Orig.prototype;
    }
  });
  const page = await ctx.newPage();
  const tag = `${url}@${w}${opts.reduced ? ' reduced' : ''}`;
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`[${tag}] console.error: ${m.text()}`); });
  page.on('pageerror', (e) => consoleErrors.push(`[${tag}] pageerror: ${e.message}`));
  page.on('requestfailed', (r) => consoleErrors.push(`[${tag}] requestfailed: ${r.url()}`));
  page.on('response', (r) => { if (r.status() >= 400) consoleErrors.push(`[${tag}] HTTP ${r.status()}: ${r.url()}`); });
  page.on('request', (r) => { if (!r.url().startsWith(BASE) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) externalRequests.push(r.url()); });
  await page.goto(BASE + url, { waitUntil: 'load' });
  await sleep(500);
  return { page, ctx };
}
async function shot(page, name, opts = {}) {
  const file = path.join(SHOTS, name + '.png');
  await page.screenshot({ path: file, fullPage: !!opts.full });
  shots.push('screenshots/' + name + '.png');
}
const noOverflow = async (page, label) => {
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  check(`横スクロールなし ${label}`, o.sw <= o.iw + 1, `scrollWidth=${o.sw} innerWidth=${o.iw}`);
};
async function scrollToY(page, y) { await page.evaluate((yy) => window.scrollTo(0, yy), y); await sleep(750); }

/* ===== 1) 各ページ×3幅：読み込み・エラー・はみ出し・スクショ ===== */
const PAGES = [['index.html', 'index'], ['products.html', 'products'], ['product.html?id=TM-HB-2101', 'product'], ['contact.html?sku=TM-HB-2101', 'contact'], ['spec.html?id=TM-HB-2101', 'spec']];
for (const w of WIDTHS) {
  for (const [url, name] of PAGES) {
    const { page, ctx } = await open(w, url);
    await noOverflow(page, `${name}@${w}`);
    if (name !== 'index') await shot(page, `${name}-${w}`, { full: true });
    if (name === 'index') {
      const info = await page.evaluate(() => { const st = window.ScrollTrigger.getAll().find((s) => s.pin); return st ? { start: st.start, end: st.end, scenes: document.querySelectorAll('.scene').length, scrub: document.getElementById('story').classList.contains('is-scrub') } : null; });
      check(`index: ScrollTrigger pin 有効 @${w}`, info && info.scrub && info.scenes === 4, JSON.stringify(info));
      await shot(page, `index-${w}-top`);
      const per = (info.end - info.start) / 4;
      const marks = w === 768 ? [[0, 0.3], [1, 0.3], [2, 0.7], [3, 0.5]] : [[0, 0.05], [0, 0.3], [0, 0.7], [1, 0.3], [1, 0.7], [2, 0.3], [2, 0.8], [3, 0.3], [3, 0.8]];
      for (const [i, t] of marks) {
        await scrollToY(page, info.start + per * (i + t));
        const st = await page.evaluate(() => ({
          cur: [...document.querySelectorAll('#progress a')].findIndex((a) => a.getAttribute('aria-current') === 'step'),
          bubbles: [...document.querySelectorAll('.bubble')].map((b) => +(+getComputedStyle(b).opacity).toFixed(2)),
          pinned: getComputedStyle(document.getElementById('story')).position,
        }));
        check(`場面${i + 1} t=${t} 進行表示が場面${i + 1} @${w}`, st.cur === i || (t < 0.1), `current=${st.cur} bubbles=${st.bubbles.join(',')}`);
        await shot(page, `index-${w}-scene${i + 1}-${String(Math.round(t * 100)).padStart(2, '0')}`);
      }
      // 場面のあとに会社紹介が続く
      await scrollToY(page, info.end + 200);
      await shot(page, `index-${w}-after-story`);
      const inStory = await page.evaluate(() => document.documentElement.classList.contains('in-story'));
      check(`ストーリー外では進行表示を隠す @${w}`, inStory === false);
    }
    await ctx.close();
  }
}

/* ===== 2) 演出をスキップ＝1クリックで製品入口へ ===== */
for (const w of [375, 1280]) {
  const { page, ctx } = await open(w, 'index.html');
  await page.click('#skip-story');
  await sleep(600);
  const r = await page.evaluate(() => { const t = document.getElementById('products-entry').getBoundingClientRect(); return { top: Math.round(t.top), hdr: document.getElementById('site-header').offsetHeight, y: Math.round(scrollY), focus: document.activeElement.id }; });
  check(`演出をスキップ → 製品入口が画面内に見える @${w}`, r.top >= r.hdr - 2 && r.top < HEIGHT[w] * 0.5 && r.y > 600, JSON.stringify(r));
  await shot(page, `index-${w}-skip-result`);
  // ヘッダーの「製品をさがす」は常に見える（1クリックで検索ページ）
  const vis = await page.isVisible('#btn-products');
  check(`「製品をさがす」常時表示 @${w}`, vis);
  await Promise.all([page.waitForURL('**/products.html'), page.click('#btn-products')]);
  check(`製品をさがす → products.html @${w}`, page.url().endsWith('products.html'));
  await ctx.close();
}

/* ===== 3) 音：既定OFF・自動再生なし・トグルで切替 ===== */
{
  const { page, ctx } = await open(1280, 'index.html');
  const before = await page.evaluate(() => ({ ac: window.__ac, pressed: document.getElementById('sound-toggle').getAttribute('aria-pressed') }));
  check('音は既定OFF・AudioContext未生成', before.ac === 0 && before.pressed === 'false', JSON.stringify(before));
  await page.click('#sound-toggle'); await sleep(400);
  const on = await page.evaluate(() => ({ ac: window.__ac, pressed: document.getElementById('sound-toggle').getAttribute('aria-pressed'), txt: document.querySelector('#sound-toggle .state').textContent }));
  check('音トグルON（aria-pressed=true, AudioContext生成）', on.pressed === 'true' && on.ac === 1 && on.txt === 'ON', JSON.stringify(on));
  await page.click('#sound-toggle'); await sleep(300);
  check('音トグルOFFへ戻る', (await page.getAttribute('#sound-toggle', 'aria-pressed')) === 'false');
  await ctx.close();
}

/* ===== 4) 動きを減らす：OS設定・手動トグル ===== */
for (const w of [375, 1280]) {
  const { page, ctx } = await open(w, 'index.html', { reduced: true });
  const r = await page.evaluate(() => ({ scrub: document.getElementById('story').classList.contains('is-scrub'), st: window.ScrollTrigger ? window.ScrollTrigger.getAll().length : -1, pos: getComputedStyle(document.getElementById('story')).position, motion: document.documentElement.dataset.motion, pressed: document.getElementById('motion-toggle').getAttribute('aria-pressed'), h: document.getElementById('story').offsetHeight, bubblesVisible: [...document.querySelectorAll('.bubble')].every((b) => +getComputedStyle(b).opacity === 1), lenis: document.documentElement.classList.contains('lenis') }));
  check(`prefers-reduced-motion: ピン/スクラブ/Lenisなし・全文表示 @${w}`, !r.scrub && r.st === 0 && r.bubblesVisible && !r.lenis && r.motion === 'reduce' && r.pressed === 'true', JSON.stringify(r));
  await shot(page, `index-${w}-reduced-top`);
  await shot(page, `index-${w}-reduced-full`, { full: true });
  for (let i = 1; i <= 4; i++) {
    await page.evaluate((id) => document.getElementById(id).scrollIntoView(), 'scene-' + i); await sleep(300);
    if (i === 2 || i === 3) await shot(page, `index-${w}-reduced-scene${i}`);
  }
  await ctx.close();
}
{
  const { page, ctx } = await open(1280, 'index.html');
  await page.click('#motion-toggle'); await sleep(700);
  const a = await page.evaluate(() => ({ scrub: document.getElementById('story').classList.contains('is-scrub'), ls: localStorage.getItem('tm-reduce-motion'), st: window.ScrollTrigger.getAll().length }));
  check('手動「動きを減らす」ON：静止レイアウト＋localStorage保存', !a.scrub && a.ls === 'true' && a.st === 0, JSON.stringify(a));
  await page.reload({ waitUntil: 'load' }); await sleep(500);
  const b = await page.evaluate(() => ({ scrub: document.getElementById('story').classList.contains('is-scrub'), pressed: document.getElementById('motion-toggle').getAttribute('aria-pressed') }));
  check('リロード後も設定が保持される', !b.scrub && b.pressed === 'true', JSON.stringify(b));
  await page.click('#motion-toggle'); await sleep(900);
  const c = await page.evaluate(() => ({ scrub: document.getElementById('story').classList.contains('is-scrub'), st: window.ScrollTrigger.getAll().length }));
  check('手動OFFで演出が復帰', c.scrub && c.st >= 1, JSON.stringify(c));
  await ctx.close();
}

/* ===== 5) 製品検索：絞り込み・URL・比較・お気に入り・最近見た ===== */
{
  const { page, ctx } = await open(1280, 'products.html');
  const count = async () => (await page.locator('#results .pcard').count());
  check('製品24件を表示', (await count()) === 24, String(await count()));
  await page.check('#f-use input[value="工場・倉庫"]'); await sleep(100);
  const nFac = await count();
  check('用途フィルタで件数が減る', nFac > 0 && nFac < 24, String(nFac));
  check('URLにuseが反映', page.url().includes('use=%E5%B7%A5%E5%A0%B4'), page.url());
  await page.check('#f-env input[value="粉じん環境"]'); await sleep(100);
  const nDust = await count();
  check('設置環境フィルタ追加でさらに絞り込み', nDust > 0 && nDust <= nFac, String(nDust));
  await page.selectOption('#f-ip', '66'); await sleep(100);
  const ipOk = await page.evaluate(() => [...document.querySelectorAll('#results .pcard .mini dd:nth-of-type(3)')].every((e) => +e.textContent.replace('IP', '') >= 66));
  check('IP66以上フィルタが効く', ipOk);
  await page.click('#btn-clear'); await sleep(100);
  check('条件クリアで24件に戻る', (await count()) === 24 && !page.url().includes('use='));
  await page.fill('#q', 'TM-LD-1203'); await sleep(100);
  check('品番検索 TM-LD-1203 → 1件', (await count()) === 1);
  await page.fill('#q', 'ld1203'); await sleep(100);
  check('品番検索（ハイフン省略 ld1203）→ 1件', (await count()) === 1);
  await page.fill('#q', '防湿'); await sleep(100);
  const nW = await count();
  check('キーワード「防湿」で絞り込み', nW >= 2 && nW < 24, String(nW));
  await page.fill('#q', 'zzzz存在しない'); await sleep(100);
  check('0件時のメッセージ表示', (await page.locator('.empty').count()) === 1);
  await shot(page, 'products-1280-empty');
  await page.fill('#q', ''); await sleep(100);
  // URL復元
  await page.goto(BASE + 'products.html?use=%E5%B1%8B%E5%A4%96%E3%83%BB%E8%A1%97%E8%B7%AF&price=3&q=%E6%8A%95%E5%85%89'); await sleep(500);
  const restored = await page.evaluate(() => ({ n: document.querySelectorAll('#results .pcard').length, use: document.querySelector('#f-use input[value="屋外・街路"]').checked, price: document.getElementById('f-price').value, q: document.getElementById('q').value }));
  check('共有URLから条件が復元される', restored.use && restored.price === '3' && restored.q === '投光' && restored.n >= 1, JSON.stringify(restored));
  await page.goto(BASE + 'products.html'); await sleep(500);
  // 比較（3件まで）
  const boxes = page.locator('#results input[data-cmp]');
  await boxes.nth(0).check(); await boxes.nth(3).check(); await boxes.nth(7).check();
  const dis = await page.evaluate(() => [...document.querySelectorAll('#results input[data-cmp]')].filter((c) => !c.checked && c.disabled).length);
  check('比較は3件で上限（残りはdisabled）', dis === 21, String(dis));
  check('比較バー表示', await page.isVisible('#compare-bar'));
  await page.click('#cmp-open'); await sleep(200);
  const cmp = await page.evaluate(() => ({ cols: document.querySelectorAll('#compare-body thead th').length, rows: document.querySelectorAll('#compare-body tbody tr').length, diff: document.querySelectorAll('#compare-body tr.diff').length }));
  check('比較表：3製品×8項目', cmp.cols === 4 && cmp.rows === 8 && cmp.diff >= 3, JSON.stringify(cmp));
  await shot(page, 'products-1280-compare');
  await page.click('#compare-body [data-cmp-remove]'); await sleep(150);
  const after = await page.evaluate(() => document.querySelectorAll('#compare-body thead th').length);
  check('比較から外せる', after === 3, String(after));
  // お気に入り
  await page.click('#cmp-clear'); await sleep(100);
  await page.locator('#results [data-fav]').nth(1).click(); await sleep(100);
  await page.locator('#results [data-fav]').nth(4).click(); await sleep(100);
  await page.reload({ waitUntil: 'load' }); await sleep(500);
  const favN = await page.evaluate(() => document.querySelectorAll('[data-fav][aria-pressed="true"]').length);
  check('お気に入りがリロード後も残る（2件）', favN === 2, String(favN));
  await page.check('#f-fav'); await sleep(100);
  check('お気に入りのみ表示', (await count()) === 2);
  await page.uncheck('#f-fav');
  // 詳細へ → 最近見た
  await page.fill('#q', 'TM-SL-6001'); await sleep(100);
  await Promise.all([page.waitForURL('**/product.html?id=TM-SL-6001'), page.click('#results h2 a')]);
  await sleep(400);
  const rows = await page.locator('table.spec tbody tr').count();
  check('製品詳細：仕様表9行', rows === 9, String(rows));
  const dummy = await page.getAttribute('.dummy a', 'href');
  check('ダミー仕様書リンクが spec.html', /spec\.html\?id=TM-SL-6001/.test(dummy), dummy);
  const inq = await page.getAttribute('.detail-actions a.btn', 'href');
  check('詳細→お問い合わせに ?sku= 付与', /contact\.html\?sku=TM-SL-6001/.test(inq), inq);
  await page.goto(BASE + 'products.html'); await sleep(500);
  const rec = await page.evaluate(() => ({ hidden: document.getElementById('recent').hidden, txt: document.getElementById('recent-list').textContent }));
  check('最近見た製品に表示', !rec.hidden && rec.txt.includes('TM-SL-6001'), JSON.stringify(rec));
  await ctx.close();
}
for (const w of [375, 768]) {
  const { page, ctx } = await open(w, 'products.html?use=%E5%B7%A5%E5%A0%B4%E3%83%BB%E5%80%89%E5%BA%AB');
  await shot(page, `products-${w}-filtered`);
  await ctx.close();
}

/* ===== 6) 印刷レイアウト ===== */
{
  const { page, ctx } = await open(1280, 'product.html?id=TM-HB-2101');
  await page.emulateMedia({ media: 'print' });
  const hidden = await page.evaluate(() => ({ hdr: getComputedStyle(document.querySelector('.site-header')).display, act: getComputedStyle(document.querySelector('.detail-actions')).display, po: getComputedStyle(document.querySelector('.print-only')).display }));
  check('印刷CSS：ヘッダー・操作ボタン非表示、印刷用見出し表示', hidden.hdr === 'none' && hidden.act === 'none' && hidden.po !== 'none', JSON.stringify(hidden));
  await shot(page, 'product-print-preview', { full: true });
  await ctx.close();
}

/* ===== 7) お問い合わせ：事前入力・検証・送信なし ===== */
{
  const { page, ctx } = await open(1280, 'contact.html?sku=TM-HB-2101');
  check('?sku= が品番欄に入る', (await page.inputValue('#sku')) === 'TM-HB-2101');
  const posts = []; page.on('request', (r) => { if (r.method() !== 'GET') posts.push(r.method() + ' ' + r.url()); });
  await page.click('button[type=submit]'); await sleep(200);
  const errs = await page.evaluate(() => ({ sum: !document.getElementById('errsum').hidden, n: document.querySelectorAll('.err:not(:empty)').length, invalid: document.querySelectorAll('[aria-invalid="true"]').length, focus: document.activeElement.id }));
  check('空送信でエラー表示・要約へフォーカス', errs.sum && errs.n === 6 && errs.invalid === 6 && errs.focus === 'errsum', JSON.stringify(errs));
  await shot(page, 'contact-1280-errors', { full: true });
  await page.fill('#company', '例）架空商事'); await page.fill('#name', '山田 太郎'); await page.fill('#email', 'bad'); await page.fill('#message', 'TM-HB-2101 の納期を知りたいです。よろしくお願いします。');
  await page.selectOption('#kind', { index: 2 }); await page.check('#agree');
  await page.click('button[type=submit]'); await sleep(150);
  check('メール形式エラーを検出', (await page.textContent('#email-err')).includes('形式'));
  await page.fill('#email', 'taro@example.com');
  await page.click('button[type=submit]'); await sleep(200);
  const done = await page.evaluate(() => ({ done: !document.getElementById('done').hidden, form: document.getElementById('form').hidden, txt: document.getElementById('done').textContent }));
  check('送信後はデモ確認表示（送信しない）', done.done && done.form && done.txt.includes('送信されていません') && done.txt.includes('TM-HB-2101'), '');
  check('フォーム送信でネットワークリクエストなし', posts.length === 0, posts.join(','));
  await shot(page, 'contact-1280-done', { full: true });
  await ctx.close();
}

/* ===== 8) キーボード操作：フォーカスの見え方 ===== */
{
  const { page, ctx } = await open(1280, 'index.html');
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  const f = await page.evaluate(() => { const el = document.activeElement; const cs = getComputedStyle(el); return { tag: el.tagName, text: el.textContent.trim().slice(0, 12), outline: cs.outlineStyle + ' ' + cs.outlineWidth }; });
  check('Tabでフォーカスが可視（outline）', /solid 3px/.test(f.outline), JSON.stringify(f));
  await shot(page, 'index-1280-focus');
  await ctx.close();
}

await browser.close(); server.close();

const failed = results.filter((r) => !r.ok);
const summary = { checks: results.length, passed: results.length - failed.length, failed: failed.length, consoleErrors: consoleErrors.length, externalRequests: externalRequests.length, screenshots: shots.length };
console.log('\n=== SUMMARY ===\n' + JSON.stringify(summary, null, 2));
if (consoleErrors.length) console.log('console errors:\n' + consoleErrors.join('\n'));
if (externalRequests.length) console.log('external requests:\n' + [...new Set(externalRequests)].join('\n'));
if (failed.length) console.log('FAILED:\n' + failed.map((f) => '- ' + f.name + ' ' + f.detail).join('\n'));
fs.writeFileSync(path.join(SHOTS, 'verify-report.json'), JSON.stringify({ summary, results, consoleErrors, externalRequests: [...new Set(externalRequests)], screenshots: shots }, null, 1));
process.exit(failed.length || consoleErrors.length ? 1 : 0);
