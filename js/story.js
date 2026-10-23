// index.html：スクロール場面の制御（GSAP ScrollTrigger の pin + scrub）
import { initChrome, isReduced, onMotionChange } from './common.js';
import { bindToggle, setScene } from './sound.js';

const NS = 'http://www.w3.org/2000/svg';
const root = document.documentElement;
const story = document.getElementById('story');
const scenes = [...story.querySelectorAll('.scene')];
const bar = document.getElementById('story-bar');
const progress = document.getElementById('progress');
const progressLinks = [...progress.querySelectorAll('a')];
const ctaLinks = [...story.querySelectorAll('[data-cta]')];
const SCENES = scenes.length;

let mm = null, lenis = null, tickerFn = null, trigger = null, currentIdx = -1;

/* ---------- 軽い乱数（毎回同じ配置になるよう固定シード） ---------- */
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const mk = (name, attrs) => { const el = document.createElementNS(NS, name); for (const k in attrs) el.setAttribute(k, attrs[k]); return el; };

/* ---------- 重い装飾の遅延生成（星・街の窓） ---------- */
const inited = new Set();
function initScene(i) {
  if (i < 0 || i >= SCENES || inited.has(i)) return;
  inited.add(i);
  const sc = scenes[i], r = rng(1000 + i);
  sc.querySelectorAll('.stars').forEach((g) => {
    const n = +g.dataset.n || 30;
    for (let k = 0; k < n; k++) g.appendChild(mk('circle', { cx: (r() * 1600).toFixed(0), cy: (r() * 520).toFixed(0), r: (0.5 + r() * 1.1).toFixed(1) }));
  });
  ['far', 'near'].forEach((kind) => {
    const wins = sc.querySelector('.wins-' + kind);
    if (!wins) return;
    const batches = [...wins.querySelectorAll('.wb')];
    sc.querySelectorAll('.city-' + kind + ' .bld').forEach((b) => {
      const x = +b.getAttribute('x'), y = +b.getAttribute('y'), w = +b.getAttribute('width'), h = +b.getAttribute('height');
      const cols = Math.max(2, Math.floor((w - 16) / 18)), rows = Math.floor((h - 24) / 24);
      for (let c = 0; c < cols; c++) for (let rr = 0; rr < rows; rr++) {
        if (r() < 0.45) continue;
        const wx = x + 12 + c * ((w - 24) / cols), wy = y + 14 + rr * 24;
        const fill = r() < 0.85 ? '#f4bd62' : '#cfd3da';
        batches[Math.floor(r() * batches.length)].appendChild(mk('rect', { x: wx.toFixed(0), y: wy.toFixed(0), width: 7, height: 10, fill, opacity: (0.55 + r() * 0.45).toFixed(2) }));
      }
    });
  });
}
function ensureBatches() {
  scenes.forEach((sc) => sc.querySelectorAll('[class^="wins-"]').forEach((wins) => {
    if (wins.querySelector('.wb')) return;
    for (let k = 0; k < 4; k++) wins.appendChild(mk('g', { class: 'wb' }));
  }));
}

/* ---------- 静止（動きを減らす／GSAP未読込）モード ---------- */
let io = null;
function setupStatic() {
  ensureBatches();
  io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) initScene(scenes.indexOf(e.target)); });
  }, { rootMargin: '60% 0px' });
  scenes.forEach((s) => io.observe(s));
  root.classList.remove('story-ready', 'in-story');
  ctaLinks.forEach((a) => a.removeAttribute('tabindex'));
}

/* ---------- スクラブ（ピン）モード ---------- */
function setActive(idx) {
  if (idx === currentIdx) return;
  currentIdx = idx;
  progressLinks.forEach((a, k) => (k === idx ? a.setAttribute('aria-current', 'step') : a.removeAttribute('aria-current')));
  ctaLinks.forEach((a) => (idx === SCENES - 1 ? a.removeAttribute('tabindex') : a.setAttribute('tabindex', '-1')));
  setScene(idx);
  initScene(idx); initScene(idx + 1); // 現在と次の場面を生成（途中の場面へ直接移動した場合も）
}

function build() {
  const { gsap } = window;
  ensureBatches();
  initScene(0); initScene(1);
  story.classList.add('is-scrub');
  root.classList.add('story-ready');

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: story, start: 'top top', end: () => '+=' + window.innerHeight * SCENES,
      pin: true, scrub: true, anticipatePin: 1, invalidateOnRefresh: true,
      onToggle: (self) => root.classList.toggle('in-story', self.isActive),
      onUpdate: (self) => {
        gsap.set(bar, { scaleX: self.progress });
        setActive(Math.min(SCENES - 1, Math.floor(self.progress * SCENES + 0.12)));
      },
    },
  });
  trigger = tl.scrollTrigger;

  scenes.forEach((sc, i) => {
    const q = (s) => sc.querySelector(s), qa = (s) => sc.querySelectorAll(s);
    const art = q('.scene-art'), copy = q('.scene-copy');
    const lines = [...qa('.bubble')];
    const last = i === SCENES - 1;

    // 場面の切り替え：絵は短くクロスフェード、文は場面の頭で入り、終わり際に出る（中央は静止して読める）
    if (i > 0) {
      tl.fromTo(art, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.18 }, i - 0.1);
      tl.fromTo(copy, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.14, ease: 'power2.out' }, i + 0.04);
    }
    if (!last) tl.to(copy, { opacity: 0, y: -16, duration: 0.1, ease: 'power1.in' }, i + 0.86);

    // 視差：3層を別速度で横移動（transformのみ・控えめ）
    tl.fromTo(q('.layer-bg'), { xPercent: -1 }, { xPercent: 1, duration: 1 }, i);
    tl.fromTo(q('.layer-mid'), { xPercent: -2, scale: 1 }, { xPercent: 2, scale: 1.03, duration: 1 }, i);
    tl.fromTo(q('.layer-fore'), { xPercent: -3.5 }, { xPercent: 3.5, duration: 1 }, i);

    // ナレーション：1行ずつ入れ替わる
    const wins = last ? [[0.12, 0.46], [0.5, 9]] : [[0.12, 0.46], [0.5, 0.84]];
    lines.forEach((b, k) => {
      const [a, z] = wins[k];
      tl.fromTo(b, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.07, ease: 'power1.out' }, i + a);
      if (z < 2) tl.to(b, { opacity: 0, y: -8, duration: 0.05 }, i + z);
    });

    // 場面ごとの演出
    if (i === 0) {
      tl.fromTo(q('.moon'), { y: 30 }, { y: -20, duration: 1 }, i);
      tl.fromTo(q('.stars'), { opacity: 0.25 }, { opacity: 0.7, duration: 1 }, i);
      tl.fromTo(q('.dims'), { opacity: 0 }, { opacity: 1, duration: 0.2 }, i + 0.08);
      tl.fromTo(q('.win-warm'), { opacity: 0.2 }, { opacity: 1, duration: 0.3, ease: 'power2.in' }, i + 0.6);
    }
    if (i === 1) {
      tl.fromTo(q('.chip'), { opacity: 0.2 }, { opacity: 1, duration: 0.12 }, i + 0.06);
      tl.fromTo(q('.glow'), { scale: 0.15, opacity: 0, svgOrigin: '800 340' }, { scale: 1, opacity: 1, duration: 0.4, ease: 'power2.out' }, i + 0.1);
      tl.fromTo(q('.beam'), { scaleY: 0, opacity: 0.4, svgOrigin: '800 418' }, { scaleY: 1, opacity: 1, duration: 0.28, ease: 'power2.out' }, i + 0.3);
      tl.fromTo(q('.pool'), { opacity: 0 }, { opacity: 1, duration: 0.15 }, i + 0.5);
      tl.fromTo(q('.dims'), { opacity: 0 }, { opacity: 1, duration: 0.12 }, i + 0.56);
      tl.fromTo(qa('.callouts > *'), { opacity: 0 }, { opacity: 1, duration: 0.06, stagger: 0.025 }, i + 0.14);
      tl.fromTo(q('.motes'), { y: 0, opacity: 0 }, { y: -140, opacity: 0.7, duration: 1 }, i);
    }
    if (i === 2) {
      tl.fromTo(q('.sky-b'), { opacity: 0 }, { opacity: 1, duration: 0.9 }, i);
      tl.to(q('.horizon-glow'), { opacity: 0.35, duration: 0.9 }, i);
      tl.fromTo(q('.stars'), { opacity: 0 }, { opacity: 0.6, duration: 0.4 }, i + 0.5);
      qa('.wb').forEach((g) => {
        const k = [...g.parentNode.children].indexOf(g);
        tl.fromTo(g, { opacity: 0 }, { opacity: 1, duration: 0.1 }, i + 0.14 + k * 0.1 + (g.parentNode.classList.contains('wins-near') ? 0.05 : 0));
      });
      qa('.lamp-glow').forEach((g, k) => tl.fromTo(g, { opacity: 0, scaleY: 0.2 }, { opacity: 1, scaleY: 1, duration: 0.12, ease: 'power2.out' }, i + 0.5 + k * 0.07));
    }
    if (i === 3) {
      tl.fromTo(q('.sky-b'), { opacity: 0 }, { opacity: 1, duration: 0.9 }, i);
      tl.fromTo(q('.sun'), { opacity: 0.3 }, { opacity: 1, duration: 0.6 }, i);
      qa('.prod').forEach((g, k) => tl.fromTo(g, { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.2, ease: 'power2.out' }, i + 0.06 + k * 0.07));
      tl.fromTo(q('.labels'), { opacity: 0 }, { opacity: 1, duration: 0.15 }, i + 0.4);
    }
  });
  setActive(0);

  // 進行表示のクリック：場面の中ほどへスクロール
  progressLinks.forEach((a, i) => {
    a.onclick = (e) => {
      e.preventDefault();
      const y = trigger.start + (trigger.end - trigger.start) * ((i + 0.3) / SCENES);
      if (lenis) lenis.scrollTo(y, { duration: 1.2 }); else window.scrollTo({ top: y });
    };
  });
  return () => { progressLinks.forEach((a) => (a.onclick = null)); };
}

function setupScrub() {
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  if (window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.12, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    tickerFn = (t) => lenis.raf(t * 1000);
    gsap.ticker.add(tickerFn);
    gsap.ticker.lagSmoothing(0);
  }
  mm = gsap.matchMedia();
  mm.add({ mobile: '(max-width: 759px)', desktop: '(min-width: 760px)' }, () => build());
  // 先読み生成：最初は2場面だけ。残りは進行に合わせて setActive が生成する
}

function teardown() {
  if (io) { io.disconnect(); io = null; }
  if (mm) { mm.revert(); mm = null; }
  if (tickerFn && window.gsap) { window.gsap.ticker.remove(tickerFn); tickerFn = null; }
  if (lenis) { lenis.destroy(); lenis = null; }
  trigger = null; currentIdx = -1;
  story.classList.remove('is-scrub');
  root.classList.remove('story-ready', 'in-story');
  progressLinks.forEach((a) => { a.onclick = null; a.removeAttribute('aria-current'); });
  ctaLinks.forEach((a) => a.removeAttribute('tabindex'));
  if (bar) bar.style.transform = '';
}

function setup() {
  teardown();
  if (isReduced() || !window.gsap || !window.ScrollTrigger) setupStatic();
  else setupScrub();
}

/* ---------- 「演出をスキップ」：1クリックで製品の入口へ ---------- */
function bindSkip() {
  const link = document.getElementById('skip-story');
  const target = document.getElementById('products-entry');
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const hdr = document.getElementById('site-header').offsetHeight;
    if (lenis) lenis.scrollTo(target, { immediate: true, offset: -hdr });
    else window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - hdr });
    history.replaceState(null, '', '#products-entry');
    target.focus({ preventScroll: true });
    if (window.ScrollTrigger) window.ScrollTrigger.update();
  });
}

initChrome();
bindToggle(document.getElementById('sound-toggle'));
bindSkip();
onMotionChange(() => setup());
setup();
// 直接 #products-entry 付きのURLで開いた場合
if (location.hash === '#products-entry') requestAnimationFrame(() => document.getElementById('skip-story').click());
