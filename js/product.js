// product.html：製品詳細（仕様表・印刷・お気に入り・ダミー仕様書リンク）
import { initChrome, loadProducts, store, save, cctText, wattText, lumenText, priceMark, productArtEl, h } from './common.js';

initChrome();
const id = new URLSearchParams(location.search).get('id') || '';
const box = document.getElementById('detail');
const favLabel = (on) => (on ? '★ お気に入り' : '☆ お気に入り');

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
    const favBtn = h('button', { type: 'button', class: 'pill', id: 'fav', 'aria-pressed': String(favs.has(p.id)) }, favLabel(favs.has(p.id)));
    const printBtn = h('button', { type: 'button', class: 'pill', id: 'print' }, '印刷する');
    const enc = encodeURIComponent(p.id);
    box.replaceChildren(
      h('div', { class: 'detail' },
        h('div', { class: 'art' }, productArtEl(p)),
        h('div', {},
          h('p', { class: 'sku' }, p.id), h('h1', {}, p.name), h('p', {}, p.desc),
          h('div', { class: 'detail-actions' },
            h('a', { class: 'btn btn-primary', href: 'contact.html?sku=' + enc }, 'この製品について問い合わせる'), favBtn, printBtn))),
      h('h2', {}, '仕様'),
      h('div', { class: 'spec-wrap' }, h('table', { class: 'spec' }, h('caption', { class: 'sr-only' }, p.id + ' の仕様'),
        h('tbody', {}, rows.map(([k, v]) => h('tr', {}, h('th', { scope: 'row' }, k), h('td', {}, v)))))),
      h('div', { class: 'dummy no-print' }, h('strong', {}, '仕様書（ダミー）：'),
        h('a', { href: 'spec.html?id=' + enc, target: '_blank', rel: 'noopener' }, '仕様書を開く（新しいタブ・PDFではありません）'), h('br'),
        'この製品は架空のため、実在のPDFや図面はありません。上のデータから生成した見本ページです。'),
      h('p', { class: 'print-only' }, '※この資料は制作例のダミーです。製品・会社は架空です。'),
      related.length ? h('section', { class: 'related' }, h('h2', {}, '同じ用途の製品'),
        h('ul', { class: 'grid' }, related.map((r) => h('li', { class: 'pcard' }, h('article', {},
          h('div', { class: 'art' }, productArtEl(r)), h('p', { class: 'sku' }, r.id),
          h('h3', {}, h('a', { href: 'product.html?id=' + encodeURIComponent(r.id) }, r.name))))))) : null);
    printBtn.addEventListener('click', () => window.print());
    favBtn.addEventListener('click', () => {
      const cur = new Set(store('tm-fav', []));
      cur.has(p.id) ? cur.delete(p.id) : cur.add(p.id);
      save('tm-fav', [...cur]);
      favBtn.setAttribute('aria-pressed', String(cur.has(p.id)));
      favBtn.textContent = favLabel(cur.has(p.id));
    });
  }
} catch (err) {
  box.textContent = '製品データを読み込めませんでした。ローカルサーバー経由で開いてください。';
  console.warn(err);
}
