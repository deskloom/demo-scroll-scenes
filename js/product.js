// product.html：製品詳細（主要仕様・仕様表・配光イメージ・印刷・お気に入り・ダミー仕様書リンク）
import { initChrome, loadProducts, store, save, cctText, wattText, lumenText, priceMark, productArtEl, distributionArtEl, favButton, setFavState, h } from './common.js';

initChrome();
const id = new URLSearchParams(location.search).get('id') || '';
const box = document.getElementById('detail');

// 主要仕様（大きな数字）。値がない項目は「—」
function keySpec(p) {
  const item = (label, num, unit) => h('div', {}, h('dt', {}, label), h('dd', {}, num == null ? '—' : [num, unit ? h('small', {}, unit) : null]));
  const cct = p.cctMin == null ? null : p.cctMin === p.cctMax ? String(p.cctMin) : p.cctMin + '–' + p.cctMax;
  return h('dl', { class: 'keyspec' },
    item('消費電力', p.watt, 'W'), item('光束', p.lumen == null ? null : p.lumen.toLocaleString('ja-JP'), 'lm'),
    item('色温度', cct, 'K'), item('保護等級', 'IP' + p.ip));
}

try {
  const products = await loadProducts();
  const p = products.find((x) => x.id === id);
  if (!p) {
    document.title = '製品が見つかりません｜灯野工業（制作例）';
    box.replaceChildren(h('h1', {}, '製品が見つかりません'), h('p', {}, h('a', { href: 'products.html' }, '製品一覧へ戻る')));
  } else {
    document.title = `${p.id} ${p.name}｜灯野工業（制作例）`;
    document.getElementById('crumb').textContent = p.id;
    // 最近見た製品（新しい順・最大6件）
    save('tm-recent', [p.id, ...store('tm-recent', []).filter((x) => x !== p.id)].slice(0, 6));
    const favs = new Set(store('tm-fav', []));
    const rows = [
      ['品番', p.id], ['形状', p.type], ['用途', p.use.join('・')], ['設置環境', p.env.join('・')], ['色温度', cctText(p)],
      ['消費電力', wattText(p)], ['光束', lumenText(p)], ['IP等級', 'IP' + p.ip], ['価格帯', priceMark(p) + '（' + p.priceText + '・税別の目安）'],
    ];
    const related = products.filter((x) => x.id !== p.id && x.use.some((u) => p.use.includes(u))).slice(0, 3);
    const favBtn = favButton({ id: 'fav' }, favs.has(p.id));
    const printBtn = h('button', { type: 'button', class: 'pill', id: 'print' }, '印刷する');
    const enc = encodeURIComponent(p.id);
    const url = (x) => 'product.html?id=' + encodeURIComponent(x.id);
    box.replaceChildren(
      h('div', { class: 'detail' },
        h('div', { class: 'art' }, productArtEl(p)),
        h('div', { class: 'info' },
          h('div', { class: 'meta' }, h('p', { class: 'sku' }, p.id), h('span', { class: 'type' }, p.type)),
          h('h1', {}, p.name), h('p', { class: 'desc' }, p.desc),
          keySpec(p),
          h('div', { class: 'detail-actions' },
            h('a', { class: 'btn btn-primary', href: 'contact.html?sku=' + enc }, 'この製品について問い合わせる', h('span', { class: 'arr', 'aria-hidden': 'true' })), favBtn, printBtn))),
      h('div', { class: 'dsec' },
        h('section', { 'aria-labelledby': 'spec-title' }, h('h2', { id: 'spec-title' }, '仕様'),
          h('div', { class: 'spec-wrap' }, h('table', { class: 'spec' }, h('caption', { class: 'sr-only' }, p.id + ' の仕様'),
            h('tbody', {}, rows.map(([k, v]) => h('tr', {}, h('th', { scope: 'row' }, k), h('td', {}, v)))))),
          h('div', { class: 'dummy no-print' }, h('strong', {}, '仕様書（ダミー）'),
            h('a', { href: 'spec.html?id=' + enc, target: '_blank', rel: 'noopener' }, '仕様書を開く（新しいタブ・PDFではありません）'), h('br'),
            'この製品は架空のため、実在のPDFや図面はありません。上のデータから生成した見本ページです。')),
        h('section', { 'aria-labelledby': 'dist-title' }, h('h2', { id: 'dist-title' }, '配光イメージ'),
          h('figure', { class: 'dist' }, distributionArtEl(p), h('figcaption', {}, '形状からの模式図です（測定値ではありません）。')))),
      h('p', { class: 'print-only' }, '※この資料は制作例のダミーです。製品・会社は架空です。'),
      related.length ? h('section', { class: 'related', 'aria-labelledby': 'rel-title' }, h('h2', { id: 'rel-title' }, '同じ用途の製品'),
        h('ul', { class: 'grid' }, related.map((r) => h('li', { class: 'pcard' }, h('article', {},
          h('a', { class: 'art', href: url(r), tabindex: '-1', 'aria-hidden': 'true' }, productArtEl(r)),
          h('div', { class: 'meta' }, h('p', { class: 'sku' }, r.id), h('span', { class: 'type' }, r.type)),
          h('h3', {}, h('a', { href: url(r) }, r.name))))))) : null);
    printBtn.addEventListener('click', () => window.print());
    favBtn.addEventListener('click', () => {
      const cur = new Set(store('tm-fav', []));
      cur.has(p.id) ? cur.delete(p.id) : cur.add(p.id);
      save('tm-fav', [...cur]);
      setFavState(favBtn, cur.has(p.id));
    });
  }
} catch (err) {
  box.textContent = '製品データを読み込めませんでした。ローカルサーバー経由で開いてください。';
  console.warn(err);
}
