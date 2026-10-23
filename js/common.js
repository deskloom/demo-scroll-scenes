// 共通：動きを減らす設定・ヘッダー高さ・ストレージ補助
const KEY = 'tm-reduce-motion';
const mql = window.matchMedia('(prefers-reduced-motion: reduce)');

export function store(key, fallback) {
  try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
}
export function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 保存できない環境は無視 */ }
}

export function osReduced() { return mql.matches; }
export function manualReduced() { return store(KEY, false) === true; }
export function isReduced() { return osReduced() || manualReduced(); }

const listeners = new Set();
export function onMotionChange(fn) { listeners.add(fn); }
function applyMotion() {
  document.documentElement.dataset.motion = isReduced() ? 'reduce' : 'full';
  const btn = document.getElementById('motion-toggle');
  if (btn) {
    btn.setAttribute('aria-pressed', String(isReduced()));
    btn.disabled = osReduced();
    btn.title = osReduced() ? 'OSの設定で「視覚効果を減らす」が有効なため、常に動きを減らしています' : '';
  }
}
function notify() { applyMotion(); listeners.forEach((fn) => fn(isReduced())); }

export function initChrome() {
  applyMotion();
  const btn = document.getElementById('motion-toggle');
  if (btn) btn.addEventListener('click', () => { save(KEY, !manualReduced()); notify(); });
  mql.addEventListener('change', notify);
  // ヘッダー高さをCSS変数へ（アンカー位置・演出レイアウト用）
  const hdr = document.getElementById('site-header');
  if (hdr) {
    const set = () => document.documentElement.style.setProperty('--hdr', hdr.offsetHeight + 'px');
    set();
    if ('ResizeObserver' in window) new ResizeObserver(set).observe(hdr);
    window.addEventListener('resize', set);
  }
}

export async function loadProducts() {
  const res = await fetch('data/products.json');
  if (!res.ok) throw new Error('products.json ' + res.status);
  return res.json();
}

export function cctText(p) {
  if (p.cctMin == null) return '—';
  return p.cctMin === p.cctMax ? p.cctMin + 'K' : p.cctMin + '〜' + p.cctMax + 'K（調色）';
}
export const wattText = (p) => (p.watt == null ? '—' : p.watt + 'W');
export const lumenText = (p) => (p.lumen == null ? '—' : p.lumen.toLocaleString('ja-JP') + 'lm');
export const priceMark = (p) => '¥'.repeat(p.priceBand);

// 製品のイメージ図（インラインSVG）。写真の代わりに「明るいスタジオで点灯した製品」を描く。
// 発光面の色は色温度から決め、光（アンバー〜白）だけが色を持つ。グラデーションIDは呼び出しごとに一意。
let artSeq = 0;
const SVGNS = 'http://www.w3.org/2000/svg';
export function lightColor(p) {
  if (p.cctMin == null) return '#fff1d2';
  const k = (p.cctMin + p.cctMax) / 2;
  return k <= 3000 ? '#ffc96e' : k <= 4200 ? '#ffe3a8' : k <= 5600 ? '#fff6e2' : '#e9f1ff';
}
export function productArt(p) {
  const u = 'a' + (++artSeq), L = lightColor(p);
  const white = `url(#${u}w)`, dark = `url(#${u}d)`, alu = `url(#${u}m)`, cone = `url(#${u}c)`, glow = `url(#${u}g)`;
  const defs = `<defs>
    <linearGradient id="${u}bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e4e0d8"/><stop offset=".62" stop-color="#f1eee8"/><stop offset="1" stop-color="#e9e5dd"/></linearGradient>
    <linearGradient id="${u}w" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#cfcfcb"/><stop offset=".35" stop-color="#fbfbf9"/><stop offset=".7" stop-color="#e6e6e2"/><stop offset="1" stop-color="#b9bab5"/></linearGradient>
    <linearGradient id="${u}d" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1e2024"/><stop offset=".4" stop-color="#4b4e55"/><stop offset=".6" stop-color="#3a3d43"/><stop offset="1" stop-color="#16171a"/></linearGradient>
    <linearGradient id="${u}m" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8d9096"/><stop offset=".45" stop-color="#e8e9ea"/><stop offset=".6" stop-color="#c3c5c9"/><stop offset="1" stop-color="#6f7278"/></linearGradient>
    <linearGradient id="${u}c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${L}" stop-opacity=".95"/><stop offset=".55" stop-color="${L}" stop-opacity=".28"/><stop offset="1" stop-color="${L}" stop-opacity="0"/></linearGradient>
    <radialGradient id="${u}g"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="${L}"/><stop offset="1" stop-color="${L}" stop-opacity="0"/></radialGradient>
    <radialGradient id="${u}s"><stop offset="0" stop-color="#18191c" stop-opacity=".28"/><stop offset="1" stop-color="#18191c" stop-opacity="0"/></radialGradient>
  </defs>`;
  const floor = (rx = 46) => `<ellipse cx="80" cy="106" rx="${rx}" ry="5" fill="url(#${u}s)"/>`;
  const halo = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${glow}" opacity=".55"/>`;
  const name = p.name || '';
  const shapes = {
    'ダウンライト': `<path d="M66 52L40 106H120L94 52Z" fill="${cone}" opacity=".7"/>${floor(40)}
      <rect x="60" y="20" width="40" height="22" fill="${dark}"/>${[64, 70, 76, 82, 88, 94].map((x) => `<rect x="${x}" y="16" width="2.4" height="26" fill="#2a2c31"/>`).join('')}
      <ellipse cx="80" cy="46" rx="40" ry="10" fill="${white}" stroke="#a9aaa6" stroke-width=".6"/>
      <ellipse cx="80" cy="47.5" rx="28" ry="6.6" fill="${alu}"/>${halo(80, 49, 20)}<ellipse cx="80" cy="49.5" rx="15" ry="3.4" fill="${L}"/><ellipse cx="80" cy="49.5" rx="7" ry="1.6" fill="#fff"/>`,
    'ハイベイ': `<path d="M44 60L18 106H142L116 60Z" fill="${cone}" opacity=".7"/>${floor(54)}
      <path d="M80 4V22" stroke="#4b4e55" stroke-width="2"/><circle cx="80" cy="5" r="3" fill="none" stroke="#4b4e55" stroke-width="1.6"/>
      <path d="M56 40Q56 22 80 22Q104 22 104 40Z" fill="${dark}"/>${[60, 66, 72, 78, 84, 90, 96].map((x) => `<path d="M${x + 1} 26V40" stroke="#5b5e65" stroke-width="1"/>`).join('')}
      <path d="M50 40H110L120 58H40Z" fill="${alu}"/><path d="M50 40H110" stroke="#2a2c31" stroke-width="1.4"/>
      ${halo(80, 60, 30)}<ellipse cx="80" cy="59" rx="40" ry="4.5" fill="${L}"/><ellipse cx="80" cy="59" rx="24" ry="2.2" fill="#fff"/>`,
    'ベースライト': `<path d="M30 60L8 106H152L134 60Z" fill="${cone}" opacity=".6"/>${floor(64)}
      <path d="M18 38H130L146 46H34Z" fill="#f5f5f2" stroke="#b9bab5" stroke-width=".6"/>
      <path d="M34 46H146V55H34Z" fill="${white}"/><path d="M18 38L34 46V55L18 47Z" fill="#c9cac6"/>
      ${halo(90, 58, 26)}<path d="M36 55H144L141 60H39Z" fill="${L}"/><path d="M44 57H136" stroke="#fff" stroke-width="1.2"/>`,
    'スポットライト': `<path d="M88 66L104 106H140L100 60Z" fill="${cone}" opacity=".75"/>${floor(36)}
      <rect x="42" y="8" width="76" height="7" fill="${dark}"/><rect x="70" y="15" width="16" height="7" fill="#2a2c31"/><path d="M78 22V34" stroke="#2a2c31" stroke-width="4"/>
      <g transform="rotate(-28 78 40)"><rect x="64" y="32" width="28" height="40" rx="4" fill="${dark}"/>${[38, 44, 50].map((y) => `<path d="M64 ${y}H92" stroke="#5b5e65" stroke-width=".8"/>`).join('')}
      <ellipse cx="78" cy="72" rx="13" ry="3.6" fill="#2a2c31"/>${halo(78, 73, 14)}<ellipse cx="78" cy="72.4" rx="9" ry="2.4" fill="${L}"/><ellipse cx="78" cy="72.4" rx="4" ry="1" fill="#fff"/></g>`,
    '投光器': `${floor(46)}
      <path d="M52 92V100H108V92" fill="none" stroke="#2a2c31" stroke-width="4"/><path d="M80 82V96" stroke="#2a2c31" stroke-width="5"/>
      <path d="M44 56H116" stroke="#2a2c31" stroke-width="3"/><path d="M46 56V88M114 56V88" stroke="#2a2c31" stroke-width="3"/>
      <rect x="36" y="22" width="88" height="62" rx="5" fill="${dark}"/>${[26, 32, 38].map((y) => `<path d="M30 ${y}H36M124 ${y}H130" stroke="#3a3d43" stroke-width="2"/>`).join('')}
      <rect x="42" y="28" width="76" height="50" rx="2" fill="#2a2c31"/>${halo(80, 53, 34)}<rect x="45" y="31" width="70" height="44" rx="1.5" fill="${L}" opacity=".92"/>
      ${[0, 1, 2].map((r) => [0, 1, 2, 3, 4].map((c) => `<circle cx="${52 + c * 14}" cy="${40 + r * 13}" r="3.6" fill="#fff" opacity=".95"/>`).join('')).join('')}
      <rect x="45" y="31" width="70" height="44" rx="1.5" fill="none" stroke="#ffffff" stroke-opacity=".6"/>`,
    '街路灯': `<path d="M106 34L84 106H150L124 34Z" fill="${cone}" opacity=".7"/>${floor(40)}
      <path d="M46 106V30Q46 22 56 22H98" fill="none" stroke="${'#3a3d43'}" stroke-width="5"/><rect x="40" y="100" width="12" height="6" fill="#2a2c31"/>
      <path d="M92 18H138L132 32H98Z" fill="${dark}"/>${halo(115, 33, 16)}<path d="M100 32H130L128 35H102Z" fill="${L}"/>`,
    'ペンダント': (/ガラス/.test(name)
      ? `<path d="M60 76L34 106H126L100 76Z" fill="${cone}" opacity=".7"/>${floor(42)}<path d="M80 0V34" stroke="#3a3d43" stroke-width="1.4"/><rect x="74" y="32" width="12" height="8" fill="#3a3d43"/>
         ${halo(80, 58, 34)}<path d="M54 76Q50 40 80 38Q110 40 106 76Z" fill="${L}" opacity=".55" stroke="#c49a52" stroke-width=".8"/><circle cx="80" cy="58" r="9" fill="#fff" opacity=".95"/><path d="M62 50Q64 44 70 42" stroke="#fff" stroke-width="2" fill="none" opacity=".8"/><ellipse cx="80" cy="76" rx="26" ry="3" fill="${L}"/>`
      : `<path d="M58 72L30 106H130L102 72Z" fill="${cone}" opacity=".7"/>${floor(44)}<path d="M80 0V30" stroke="#3a3d43" stroke-width="1.4"/><rect x="75" y="28" width="10" height="8" fill="#3a3d43"/>
         <path d="M48 72Q48 36 80 36Q112 36 112 72Z" fill="${alu}"/><path d="M48 72H112" stroke="#6f7278" stroke-width="1.2"/>${halo(80, 73, 22)}<ellipse cx="80" cy="73" rx="30" ry="3.4" fill="${L}"/><ellipse cx="80" cy="73" rx="12" ry="1.4" fill="#fff"/>`),
    '光学部品': (/レンズ/.test(name)
      ? `<path d="M64 62L52 106H108L96 62Z" fill="${cone}" opacity=".6"/>${floor(40)}
         <ellipse cx="80" cy="58" rx="36" ry="12" fill="#f7f6f2" stroke="#b3b4af" stroke-width=".8"/><path d="M44 58V64Q80 82 116 64V58" fill="#e1e2de" opacity=".9"/>
         ${[28, 20, 12].map((r) => `<ellipse cx="80" cy="57" rx="${r}" ry="${r / 3}" fill="none" stroke="#b9bab5" stroke-width=".8"/>`).join('')}${halo(80, 57, 14)}<ellipse cx="80" cy="57" rx="5" ry="1.8" fill="#fff"/>`
      : /パネル/.test(name)
        ? `${floor(58)}<path d="M18 70L58 40H142L102 70Z" fill="#fbfbf8" stroke="#bdbeb9" stroke-width=".8"/>${halo(80, 55, 40)}<path d="M18 70H102V74H18Z" fill="#d9d9d4"/><path d="M102 70L142 40V44L102 74Z" fill="#c8c9c4"/>
           <path d="M30 66L62 44H128L96 66Z" fill="${L}" opacity=".45"/>`
        : `${floor(42)}<path d="M50 40L66 84H94L110 40Z" fill="${alu}"/>${[0, 1, 2, 3].map((k) => `<path d="M${54 + k * 2} ${50 + k * 9}H${106 - k * 2}" stroke="#ffffff" stroke-width=".9" opacity=".7"/>`).join('')}
           <ellipse cx="80" cy="40" rx="30" ry="7" fill="#d6d8db" stroke="#8d9096" stroke-width=".8"/><ellipse cx="80" cy="40" rx="24" ry="5" fill="#f4f5f6"/><ellipse cx="80" cy="84" rx="14" ry="3" fill="#6f7278"/>${halo(80, 40, 12)}`),
  };
  const body = shapes[p.type] || shapes['ダウンライト'];
  return `<svg xmlns="${SVGNS}" viewBox="0 0 160 120" role="img" aria-label="${p.type}のイメージ図（簡易イラスト）" focusable="false">${defs}<rect width="160" height="120" fill="url(#${u}bg)"/>${body}</svg>`;
}

// 配光のイメージ（極座標の模式図）。数値は架空・形状の目安のみ。
const SPREAD = { 'ダウンライト': 2.4, 'ハイベイ': 1.6, 'ベースライト': 1, 'スポットライト': 9, '投光器': 4, '街路灯': 0, 'ペンダント': 1.4, '光学部品': 6 };
export function distributionArt(p) {
  const n = SPREAD[p.type] ?? 2, R = 92, cx = 110, cy = 18;
  const pts = [];
  for (let a = -90; a <= 90; a += 3) {
    const t = (a * Math.PI) / 180, c = Math.cos(t);
    const r = n === 0 ? R * c * (0.55 + 0.45 * Math.pow(Math.sin(2 * Math.abs(t) * 0.75), 2)) : R * Math.pow(c, n);
    pts.push(`${(cx + r * Math.sin(t)).toFixed(1)} ${(cy + r * c).toFixed(1)}`);
  }
  const rings = [1, 0.66, 0.33].map((k) => `<path d="M${cx - R * k} ${cy}A${R * k} ${R * k} 0 0 0 ${cx + R * k} ${cy}" fill="none" stroke="#c4beb3" stroke-width=".8"/>`).join('');
  const spokes = [-60, -30, 0, 30, 60].map((a) => { const t = (a * Math.PI) / 180; return `<path d="M${cx} ${cy}L${(cx + R * Math.sin(t)).toFixed(1)} ${(cy + R * Math.cos(t)).toFixed(1)}" stroke="#d9d4cb" stroke-width=".8"/>`; }).join('');
  const labels = [['0°', cx + 3, cy + R + 12], ['30°', cx + 52, cy + 92], ['60°', cx + 88, cy + 54], ['90°', cx + R - 14, cy + 12]].map(([t, x, y]) => `<text x="${x}" y="${y}" font-size="8" fill="#5e6168">${t}</text>`).join('');
  return `<svg xmlns="${SVGNS}" viewBox="0 0 220 128" role="img" aria-label="${p.type}の配光イメージ（模式図）" focusable="false"><path d="M${cx - R - 6} ${cy}H${cx + R + 6}" stroke="#18191c" stroke-width="1"/>${rings}${spokes}<path d="M${pts.join('L')}Z" fill="#e9a23b" fill-opacity=".18" stroke="#8a5a12" stroke-width="1.6" stroke-linejoin="round"/>${labels}</svg>`;
}

// DOM生成ヘルパー（innerHTMLを使わない）。attrs の値は文字列。null/false は無視。
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v; else el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...kids.flat().filter((c) => c != null && c !== false));
  return el;
}
// productArt の文字列SVGをDOMとして取り込む（固定テンプレートのみ・外部入力なし）
// （旧版は xmlns なしで解析していたため SVG として描画されず、図が空の紺色の箱になっていた）
const svgEl = (str) => document.importNode(new DOMParser().parseFromString(str, 'image/svg+xml').documentElement, true);
export const productArtEl = (p) => svgEl(productArt(p));
export const distributionArtEl = (p) => svgEl(distributionArt(p));

const STAR = () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 16 16'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M8 1.6l1.9 4 4.4.5-3.3 3 .9 4.3L8 11.2l-3.9 2.2.9-4.3-3.3-3 4.4-.5z');
  path.setAttribute('fill', 'currentColor'); path.setAttribute('fill-opacity', '0'); path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', '1.3'); path.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(path); return svg;
};
// お気に入りボタン（星アイコン＋文言。状態は aria-pressed）
export function favButton(attrs, on) {
  const b = h('button', { type: 'button', class: 'pill fav', 'aria-pressed': String(on), ...attrs }, STAR(), h('span', {}, on ? 'お気に入り済み' : 'お気に入り'));
  b.querySelector('path').setAttribute('fill-opacity', on ? '1' : '0');
  return b;
}
export function setFavState(btn, on) {
  btn.setAttribute('aria-pressed', String(on));
  btn.querySelector('path').setAttribute('fill-opacity', on ? '1' : '0');
  btn.querySelector('span').textContent = on ? 'お気に入り済み' : 'お気に入り';
}
