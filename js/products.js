// products.html：絞り込み・検索・比較・お気に入り・最近見た製品
import { initChrome, loadProducts, store, save, cctText, wattText, lumenText, priceMark, productArtEl, h } from './common.js';

initChrome();

const MAX_COMPARE = 3;
const $ = (id) => document.getElementById(id);
const norm = (s) => String(s).normalize('NFKC').toLowerCase();
const flat = (s) => norm(s).replace(/[-\s・（）()]/g, '');

let products = [];
const state = { q: '', use: new Set(), env: new Set(), cct: '', ip: '', price: '', fav: false, sort: 'sku' };
let favs = new Set(store('tm-fav', []));
let compare = store('tm-compare', []);

const BANDS = { warm: [0, 3000], neutral: [3000, 4500], day: [4500, 5700], cool: [5700, 99999] };

function readUrl() {
  const p = new URLSearchParams(location.search);
  state.q = p.get('q') || '';
  state.use = new Set(p.getAll('use'));
  state.env = new Set(p.getAll('env'));
  state.cct = p.get('cct') || ''; state.ip = p.get('ip') || ''; state.price = p.get('price') || '';
  state.fav = p.get('fav') === '1'; state.sort = p.get('sort') || 'sku';
}
function writeUrl() {
  const p = new URLSearchParams();
  if (state.q) p.set('q', state.q);
  state.use.forEach((v) => p.append('use', v));
  state.env.forEach((v) => p.append('env', v));
  if (state.cct) p.set('cct', state.cct);
  if (state.ip) p.set('ip', state.ip);
  if (state.price) p.set('price', state.price);
  if (state.fav) p.set('fav', '1');
  if (state.sort !== 'sku') p.set('sort', state.sort);
  const qs = p.toString();
  history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
}

function matches(p) {
  if (state.use.size && !p.use.some((u) => state.use.has(u))) return false;
  if (state.env.size && !p.env.some((e) => state.env.has(e))) return false;
  if (state.cct) {
    if (p.cctMin == null) return false;
    const [lo, hi] = BANDS[state.cct];
    if (!(p.cctMin <= hi && p.cctMax >= lo)) return false;
  }
  if (state.ip && p.ip < +state.ip) return false;
  if (state.price && p.priceBand !== +state.price) return false;
  if (state.fav && !favs.has(p.id)) return false;
  if (state.q.trim()) {
    const hay = norm([p.id, p.name, p.type, p.desc, ...p.use, ...p.env].join(' '));
    const hayFlat = flat(hay);
    return norm(state.q).split(/\s+/).filter(Boolean).every((t) => hay.includes(t) || hayFlat.includes(flat(t)));
  }
  return true;
}

function sorted(list) {
  const s = state.sort, a = [...list];
  if (s === 'price-asc') a.sort((x, y) => x.priceBand - y.priceBand || x.id.localeCompare(y.id));
  else if (s === 'price-desc') a.sort((x, y) => y.priceBand - x.priceBand || x.id.localeCompare(y.id));
  else if (s === 'watt') a.sort((x, y) => (x.watt ?? 1e9) - (y.watt ?? 1e9) || x.id.localeCompare(y.id));
  else a.sort((x, y) => x.id.localeCompare(y.id));
  return a;
}

function card(p) {
  const inCmp = compare.includes(p.id), full = compare.length >= MAX_COMPARE && !inCmp;
  const fav = favs.has(p.id);
  const dd = (k, v) => [h('dt', {}, k), h('dd', {}, v)];
  return h('li', { class: 'pcard' }, h('article', { 'aria-label': p.id + ' ' + p.name },
    h('div', { class: 'art' }, productArtEl(p)),
    h('p', { class: 'sku' }, p.id),
    h('h2', {}, h('a', { href: 'product.html?id=' + encodeURIComponent(p.id) }, p.name)),
    h('p', { class: 'tags' }, p.use.join('・') + ' ／ ' + p.env.join('・')),
    h('dl', { class: 'mini' }, dd('色温度', cctText(p)), dd('消費電力', wattText(p)), dd('IP等級', 'IP' + p.ip), dd('価格帯', priceMark(p))),
    h('div', { class: 'actions' },
      h('label', { class: 'check' },
        h('input', { type: 'checkbox', 'data-cmp': p.id, checked: inCmp, disabled: full, title: full ? '比較は3件までです' : null }), ' 比較に追加'),
      h('button', { type: 'button', class: 'pill', 'data-fav': p.id, 'aria-pressed': String(fav), 'aria-label': p.id + ' をお気に入りにする' }, fav ? '★ お気に入り' : '☆ お気に入り'))));
}

function render() {
  const list = sorted(products.filter(matches));
  $('count').textContent = list.length + '件の製品が見つかりました（全' + products.length + '件）';
  $('results').replaceChildren(...(list.length ? list.map(card)
    : [h('li', { class: 'empty' }, '条件に合う製品がありません。条件をゆるめるか、「条件をすべてクリア」を押してください。')]));
  renderCompareBar();
  writeUrl();
}

/* ---------- 比較 ---------- */
function renderCompareBar() {
  const bar = $('compare-bar');
  bar.hidden = compare.length === 0;
  $('cmp-count').textContent = `比較 ${compare.length}/${MAX_COMPARE}`;
  $('cmp-chips').replaceChildren(...compare.map((id) => h('span', { class: 'chip' }, id)));
  $('cmp-open').disabled = compare.length < 2;
  $('cmp-open').title = compare.length < 2 ? '2件以上選ぶと比較できます' : '';
  if (!$('compare-panel').hidden) renderCompareTable();
  document.body.style.paddingBottom = compare.length ? '64px' : '';
}
function renderCompareTable() {
  const items = compare.map((id) => products.find((p) => p.id === id)).filter(Boolean);
  if (items.length < 2) { $('compare-body').replaceChildren(h('p', {}, '2件以上選ぶと比較表が表示されます。')); return; }
  const rows = [
    ['用途', (p) => p.use.join('・')], ['設置環境', (p) => p.env.join('・')], ['色温度', cctText], ['消費電力', wattText],
    ['光束', lumenText], ['IP等級', (p) => 'IP' + p.ip], ['価格帯', (p) => priceMark(p) + '（' + p.priceText + '）'], ['特長', (p) => p.desc],
  ];
  const head = items.map((p) => h('th', { scope: 'col' },
    h('a', { href: 'product.html?id=' + encodeURIComponent(p.id) }, p.id), h('br'), p.name, h('br'),
    h('button', { type: 'button', class: 'pill', 'data-cmp-remove': p.id }, '外す')));
  const body = rows.map(([label, fn]) => {
    const vals = items.map(fn); const diff = new Set(vals).size > 1;
    return h('tr', { class: diff ? 'diff' : null }, h('th', { scope: 'row' }, label, diff ? h('span', { class: 'sr-only' }, '（差があります）') : null), vals.map((v) => h('td', {}, v)));
  });
  $('compare-body').replaceChildren(
    h('p', { class: 'note' }, '黄色の行は製品間で値が違う項目です。'),
    h('table', { class: 'spec' }, h('caption', { class: 'sr-only' }, '製品の比較表'),
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, '項目'), head)), h('tbody', {}, body)));
}
function setCompare(next) { compare = next; save('tm-compare', compare); render(); }

/* ---------- お気に入り・最近見た製品 ---------- */
function toggleFav(id) {
  favs.has(id) ? favs.delete(id) : favs.add(id);
  save('tm-fav', [...favs]);
  render();
  const btn = document.querySelector(`[data-fav="${CSS.escape(id)}"]`); if (btn) btn.focus();
}
function renderRecent() {
  const ids = store('tm-recent', []);
  const items = ids.map((id) => products.find((p) => p.id === id)).filter(Boolean);
  $('recent').hidden = items.length === 0;
  $('recent-list').replaceChildren(...items.map((p) => h('li', {}, h('a', { href: 'product.html?id=' + encodeURIComponent(p.id) }, p.id + '　' + p.name))));
}

/* ---------- フィルタUIの生成と同期 ---------- */
function buildFilters() {
  const count = (key, v) => products.filter((p) => p[key].includes(v)).length;
  const uniq = (key) => [...new Set(products.flatMap((p) => p[key]))];
  const fill = (id, key, set) => {
    const fs = $(id);
    uniq(key).forEach((v) => {
      const l = h('label', {}, h('input', { type: 'checkbox', value: v, 'data-group': key }), ' ' + v, h('small', {}, '（' + count(key, v) + '）'));
      fs.appendChild(l);
    });
  };
  fill('f-use', 'use'); fill('f-env', 'env');
}
function syncUi() {
  $('q').value = state.q;
  document.querySelectorAll('[data-group]').forEach((c) => { c.checked = state[c.dataset.group].has(c.value); });
  $('f-cct').value = state.cct; $('f-ip').value = state.ip; $('f-price').value = state.price;
  $('f-fav').checked = state.fav; $('sort').value = state.sort;
}

function bind() {
  $('q').addEventListener('input', (e) => { state.q = e.target.value; render(); });
  $('filter-form').addEventListener('submit', (e) => e.preventDefault());
  $('filter-form').addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.group) { t.checked ? state[t.dataset.group].add(t.value) : state[t.dataset.group].delete(t.value); }
    else if (t.id === 'f-cct') state.cct = t.value;
    else if (t.id === 'f-ip') state.ip = t.value;
    else if (t.id === 'f-price') state.price = t.value;
    else if (t.id === 'f-fav') state.fav = t.checked;
    else return;
    render();
  });
  $('sort').addEventListener('change', (e) => { state.sort = e.target.value; render(); });
  $('btn-clear').addEventListener('click', () => {
    Object.assign(state, { q: '', cct: '', ip: '', price: '', fav: false, sort: 'sku' }); state.use.clear(); state.env.clear();
    syncUi(); render(); $('q').focus();
  });
  $('results').addEventListener('change', (e) => {
    const id = e.target.dataset.cmp; if (!id) return;
    if (e.target.checked) { if (compare.length < MAX_COMPARE) setCompare([...compare, id]); else render(); }
    else setCompare(compare.filter((x) => x !== id));
  });
  $('results').addEventListener('click', (e) => { const b = e.target.closest('[data-fav]'); if (b) toggleFav(b.dataset.fav); });
  $('cmp-open').addEventListener('click', () => { renderCompareTable(); $('compare-panel').hidden = false; $('compare-panel').scrollIntoView({ block: 'start' }); });
  $('cmp-close').addEventListener('click', () => { $('compare-panel').hidden = true; });
  $('cmp-clear').addEventListener('click', () => { $('compare-panel').hidden = true; setCompare([]); });
  $('compare-body').addEventListener('click', (e) => { const b = e.target.closest('[data-cmp-remove]'); if (b) setCompare(compare.filter((x) => x !== b.dataset.cmpRemove)); });
  // 狭い画面では絞り込み条件を最初は閉じる
  const mq = matchMedia('(min-width: 900px)');
  const setOpen = () => { $('filters').open = mq.matches || hasActiveFilter(); };
  mq.addEventListener('change', setOpen); setOpen();
}
const hasActiveFilter = () => state.use.size || state.env.size || state.cct || state.ip || state.price || state.fav;

try {
  products = await loadProducts();
  compare = compare.filter((id) => products.some((p) => p.id === id)).slice(0, MAX_COMPARE);
  favs = new Set([...favs].filter((id) => products.some((p) => p.id === id)));
  readUrl(); buildFilters(); syncUi(); bind(); render(); renderRecent();
} catch (err) {
  $('count').textContent = '製品データを読み込めませんでした。ローカルサーバー経由で開いてください（README参照）。';
  console.warn(err);
}
