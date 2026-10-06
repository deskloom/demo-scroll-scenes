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

/* ---------- 重い装飾の遅延生成（星・光の筋・街の窓） ---------- */
const inited = new Set();
function initScene(i) {
  if (i < 0 || i >= SCENES || inited.has(i)) return;
  inited.add(i);
  const sc = scenes[i], r = rng(1000 + i);
  sc.querySelectorAll('.stars').forEach((g) => {
    const n = +g.dataset.n || 30;
    for (let k = 0; k < n; k++) g.appendChild(mk('circle', { cx: (r() * 1600).toFixed(0), cy: (r() * 520).toFixed(0), r: (0.8 + r() * 1.6).toFixed(1) }));
  });
  sc.querySelectorAll('.rays').forEach((g) => {
    for (let k = 0; k < 14; k++) g.appendChild(mk('path', { d: 'M800 560 L772 -500 L828 -500Z', transform: `rotate(${(k * 360) / 14} 800 560)` }));
  });
  ['far', 'near'].forEach((kind) => {
    const wins = sc.querySelector('.wins-' + kind);
    if (!wins) return;
    const batches = [...wins.querySelectorAll('.wb')];
    sc.querySelectorAll('.city-' + kind + ' .bld').forEach((b) => {
      const x = +b.getAttribute('x'), y = +b.getAttribute('y'), w = +b.getAttribute('width'), h = +b.getAttribute('height');
      const cols = Math.max(2, Math.floor((w - 16) / 22)), rows = Math.floor((h - 24) / 30);
      for (let c = 0; c < cols; c++) for (let rr = 0; rr < rows; rr++) {
        if (r() < 0.38) continue;
        const wx = x + 12 + c * ((w - 24) / cols), wy = y + 14 + rr * 30;
        const fill = r() < 0.82 ? '#ffd88a' : '#bfe0ff';
        batches[Math.floor(r() * batches.length)].appendChild(mk('rect', { x: wx.toFixed(0), y: wy.toFixed(0), width: 10, height: 14, fill }));
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
  initScene(idx + 1); // 次の場面を先読みで生成
}

function build(isMobile) {
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
    const art = q('.scene-art'), copy = q('.scene-copy'), actors = q('.actors'), tomoru = q('.tomoru');
    const bubbles = [...qa('.bubble')];
    const last = i === SCENES - 1;

    // 場面の切り替え（絵はクロスフェード／文はずらして出入り）
    if (i > 0) {
      tl.fromTo(art, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.24 }, i - 0.12);
      tl.fromTo(copy, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.17 }, i + 0.05);
      tl.fromTo(actors, { opacity: 0 }, { opacity: 1, duration: 0.15 }, i - 0.05);
    }
    if (!last) {
      tl.to(copy, { opacity: 0, y: -10, duration: 0.15 }, i + 0.8);
      tl.to(actors, { opacity: 0, duration: 0.13 }, i + 0.86);
    }

    // 視差：3層を別速度で横移動（transformのみ）
    tl.fromTo(q('.layer-bg'), { xPercent: -1.5, scale: 1 }, { xPercent: 1.5, scale: 1.06, duration: 1 }, i);
    tl.fromTo(q('.layer-mid'), { xPercent: -3.5 }, { xPercent: 3.5, duration: 1 }, i);
    tl.fromTo(q('.layer-fore'), { xPercent: -6 }, { xPercent: 6, duration: 1 }, i);

    // ともる：歩きながら進む（x）＋小さく弾む（y）
    const from = +tomoru.dataset[isMobile ? 'fromM' : 'from'], to = +tomoru.dataset[isMobile ? 'toM' : 'to'];
    tl.fromTo(tomoru, { x: from + 'vw' }, { x: to + 'vw', duration: 1 }, i);
    tl.to(tomoru, { keyframes: { y: [0, -9, 0, -9, 0, -9, 0, -9, 0], easeEach: 'sine.inOut' }, duration: 1 }, i);

    // 台詞：スクロール位置で出入り
    const wins = last ? [[0.14, 0.46], [0.54, 1.5]] : [[0.1, 0.44], [0.52, 0.9]];
    bubbles.forEach((b, k) => {
      const [a, z] = wins[k];
      tl.fromTo(b, { opacity: 0, y: 10, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.08, ease: 'power1.out' }, i + a);
      if (z < 1.4) tl.to(b, { opacity: 0, y: -6, duration: 0.06 }, i + z);
    });

    // 場面ごとの演出
    if (i === 0) {
      tl.fromTo(q('.moon'), { y: 40 }, { y: -30, duration: 1 }, i);
      tl.fromTo(q('.stars'), { opacity: 0.5 }, { opacity: 1, duration: 1 }, i);
      tl.to(q('.smoke'), { y: -40, opacity: 0.05, duration: 1 }, i);
    }
    if (i === 1) {
      tl.fromTo(q('.glow'), { scale: 0.1, opacity: 0, svgOrigin: '800 560' }, { scale: 1.1, opacity: 1, duration: 0.55, ease: 'power2.out' }, i + 0.05);
      tl.fromTo(q('.rays'), { opacity: 0, rotation: 0, svgOrigin: '800 560' }, { opacity: 0.16, rotation: 40, duration: 1 }, i);
      tl.fromTo(q('.beam'), { scaleX: 0, svgOrigin: '150 640' }, { scaleX: 1, duration: 0.35 }, i + 0.45);
      tl.fromTo(q('.motes'), { y: 0 }, { y: -150, duration: 1 }, i);
    }
    if (i === 2) {
      tl.fromTo(q('.sky-b'), { opacity: 0 }, { opacity: 1, duration: 0.9 }, i);
      tl.to(q('.horizon-glow'), { opacity: 0.25, duration: 0.9 }, i);
      tl.fromTo(q('.stars'), { opacity: 0 }, { opacity: 0.9, duration: 0.4 }, i + 0.5);
      qa('.wb').forEach((g, k) => tl.fromTo(g, { opacity: 0 }, { opacity: 1, duration: 0.14 }, i + 0.15 + (k % 4) * 0.12 + (g.parentNode.classList.contains('wins-near') ? 0.06 : 0)));
      qa('.lamp-glow').forEach((g, k) => tl.fromTo(g, { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, duration: 0.16, ease: 'power2.out' }, i + 0.45 + k * 0.1));
    }
    if (i === 3) {
      tl.fromTo(q('.sky-b'), { opacity: 0 }, { opacity: 1, duration: 0.9 }, i);
      tl.fromTo(q('.sun'), { y: 200, scale: 0.7 }, { y: -20, scale: 1.2, duration: 1 }, i);
      tl.fromTo(q('.stars'), { opacity: 0.6 }, { opacity: 0, duration: 0.6 }, i);
      qa('.prod').forEach((g, k) => tl.fromTo(g, { y: 80, opacity: 0 }, { y: 0, opacity: 1, duration: 0.24, ease: 'power2.out' }, i + 0.08 + k * 0.1));
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
  mm.add({ mobile: '(max-width: 759px)', desktop: '(min-width: 760px)' }, (c) => build(!!c.conditions.mobile));
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
