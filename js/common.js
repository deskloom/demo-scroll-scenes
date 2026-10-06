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

// 製品のイメージ図（インラインSVG。形状ごとに簡易表現）
export function productArt(p) {
  const warm = p.cctMin == null ? '#fff3c4' : p.cctMin <= 3000 ? '#ffd48a' : p.cctMin <= 4500 ? '#ffe9b8' : '#eaf2ff';
  const body = '#c4c9d8', dark = '#2c3354';
  const shapes = {
    'ダウンライト': `<rect x="24" y="14" width="72" height="14" rx="3" fill="${dark}"/><path d="M34 28h52l8 22H26Z" fill="${body}"/><ellipse cx="60" cy="50" rx="34" ry="6" fill="${warm}"/><path d="M30 52h60l16 40H14Z" fill="${warm}" opacity=".35"/>`,
    'ハイベイ': `<rect x="56" y="6" width="8" height="20" fill="${dark}"/><path d="M22 58Q22 26 60 26Q98 26 98 58Z" fill="${body}"/><rect x="24" y="58" width="72" height="6" fill="${dark}"/><path d="M26 66h68l18 34H8Z" fill="${warm}" opacity=".4"/>`,
    'ベースライト': `<rect x="8" y="22" width="104" height="14" rx="4" fill="${body}"/><rect x="14" y="34" width="92" height="6" rx="3" fill="${warm}"/><path d="M14 42h92l8 50H6Z" fill="${warm}" opacity=".3"/>`,
    'スポットライト': `<rect x="6" y="14" width="108" height="6" fill="${dark}"/><rect x="54" y="20" width="12" height="14" fill="${dark}"/><g transform="rotate(-24 60 44)"><rect x="42" y="34" width="36" height="40" rx="8" fill="${body}"/><ellipse cx="60" cy="76" rx="16" ry="5" fill="${warm}"/></g><path d="M50 82L36 102H78Z" fill="${warm}" opacity=".4"/>`,
    '投光器': `<rect x="30" y="86" width="60" height="8" fill="${dark}"/><rect x="26" y="26" width="68" height="48" rx="6" fill="${body}"/><rect x="32" y="32" width="56" height="36" rx="3" fill="${warm}"/><path d="M60 74v12" stroke="${dark}" stroke-width="5"/>`,
    '街路灯': `<rect x="56" y="22" width="8" height="78" fill="${dark}"/><path d="M60 24Q60 12 84 12H100v8H86Q72 20 64 30Z" fill="${dark}"/><ellipse cx="96" cy="22" rx="14" ry="5" fill="${warm}"/><path d="M84 26h24l12 66H72Z" fill="${warm}" opacity=".28"/>`,
    'ペンダント': `<rect x="59" y="2" width="2" height="38" fill="${dark}"/><path d="M30 76Q30 40 60 40Q90 40 90 76Z" fill="${body}"/><ellipse cx="60" cy="78" rx="22" ry="5" fill="${warm}"/><path d="M38 82h44l12 22H26Z" fill="${warm}" opacity=".35"/>`,
    '光学部品': `<circle cx="60" cy="56" r="34" fill="${body}"/><circle cx="60" cy="56" r="22" fill="${warm}" opacity=".85"/><circle cx="60" cy="56" r="9" fill="#fff" opacity=".9"/><path d="M60 22v-10M60 100v10M26 56H14M106 56H94" stroke="${dark}" stroke-width="4"/>`,
  };
  return `<svg viewBox="0 0 120 110" role="img" aria-label="${p.type}のイメージ図（簡易イラスト）" focusable="false">${shapes[p.type] || shapes['ダウンライト']}</svg>`;
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
export function productArtEl(p) {
  const doc = new DOMParser().parseFromString(productArt(p), 'image/svg+xml');
  return document.importNode(doc.documentElement, true);
}
