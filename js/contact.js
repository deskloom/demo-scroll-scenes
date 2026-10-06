// contact.html：?sku= の事前入力・クライアント側のみの検証・デモ確認表示（送信なし）
import { initChrome, loadProducts } from './common.js';

initChrome();
const $ = (id) => document.getElementById(id);
const form = $('form');

// 品番の事前入力
const skuParam = (new URLSearchParams(location.search).get('sku') || '').trim().slice(0, 40);
if (skuParam) {
  $('sku').value = skuParam;
  loadProducts().then((list) => {
    const p = list.find((x) => x.id === skuParam);
    $('sku-hint').textContent = p ? `製品ページから入力しました：${p.name}` : '品番はURLから入力されました（該当製品は見つかりませんでした）。';
    if (p && !$('message').value) $('message').placeholder = `${p.id} について、`;
  }).catch(() => {});
}

const rules = {
  company: (v) => (v.trim() ? '' : '会社名を入力してください。'),
  name: (v) => (v.trim() ? '' : 'お名前を入力してください。'),
  email: (v) => (!v.trim() ? 'メールアドレスを入力してください。' : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'メールアドレスの形式が正しくありません（例：name@example.com）。'),
  tel: (v) => (!v.trim() || /^[0-9０-９+\-ー()（）\s]{8,20}$/.test(v.trim()) ? '' : '電話番号は数字とハイフンで入力してください。'),
  kind: (v) => (v ? '' : 'ご相談の種類を選んでください。'),
  message: (v) => (v.trim().length >= 10 ? '' : 'お問い合わせ内容を10文字以上で入力してください。'),
  agree: (_, el) => (el.checked ? '' : 'チェックを入れてください。'),
};
const label = { company: '会社名', name: 'お名前', email: 'メールアドレス', tel: '電話番号', kind: 'ご相談の種類', message: 'お問い合わせ内容', agree: '確認チェック' };

function check(name) {
  const el = $(name), msg = rules[name](el.value, el);
  const out = $(name + '-err');
  out.textContent = msg;
  if (msg) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
  return msg;
}
Object.keys(rules).forEach((n) => {
  const el = $(n);
  el.addEventListener('blur', () => { if (el.value || el.type === 'checkbox') check(n); });
  el.addEventListener('input', () => { if (el.getAttribute('aria-invalid')) check(n); });
  el.addEventListener('change', () => { if (el.getAttribute('aria-invalid')) check(n); });
});

form.addEventListener('submit', (e) => {
  e.preventDefault(); // どこにも送信しない
  const errors = Object.keys(rules).map((n) => [n, check(n)]).filter(([, m]) => m);
  const sum = $('errsum');
  if (errors.length) {
    sum.hidden = false;
    const strong = document.createElement('strong'); strong.textContent = '入力内容を確認してください（' + errors.length + '件）';
    const ul = document.createElement('ul');
    errors.forEach(([n, m]) => { const li = document.createElement('li'); const a = document.createElement('a'); a.href = '#' + n; a.textContent = label[n] + '：' + m; a.addEventListener('click', (ev) => { ev.preventDefault(); $(n).focus(); }); li.appendChild(a); ul.appendChild(li); });
    sum.replaceChildren(strong, ul);
    sum.focus();
    return;
  }
  sum.hidden = true;
  const list = $('done-list'); list.textContent = '';
  [['会社名', 'company'], ['お名前', 'name'], ['メール', 'email'], ['電話', 'tel'], ['種類', 'kind'], ['品番', 'sku'], ['内容', 'message']].forEach(([k, n]) => {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = $(n).value.trim() || '（未入力）';
    list.append(dt, dd);
  });
  form.hidden = true; $('done').hidden = false; $('done').focus();
});
$('back').addEventListener('click', () => { $('done').hidden = true; form.hidden = false; $('company').focus(); });
