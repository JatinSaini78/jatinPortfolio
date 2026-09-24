/* Interactive hero.
   The cursor only picks a zone (left / center / right) — the character never
   follows it. Left/right: a curious glance, held ~2.6s, then back to work.
   Center: the greeting — notice, headset off to the neck, wave, point down.

   Two renderers share one controller:
   - frames: plays pre-extracted video frames on <canvas> when
     frames/manifest.json exists (see frames/README.md for the format)
   - rig:    animates the inline SVG character (the default) */
(() => {
  'use strict';

  const hero = document.querySelector('[data-hero]');
  if (!hero) return;

  const stage = hero.querySelector('[data-stage]');
  const svg = hero.querySelector('#dev');
  const canvas = hero.querySelector('[data-frames]');
  const messageEl = hero.querySelector('[data-message]');
  const statusEl = hero.querySelector('[data-status]');
  const cue = hero.querySelector('[data-scroll-cue]');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touchLayout = matchMedia('(hover: none), (pointer: coarse), (max-width: 820px)');

  const HOLD_MS = 2600;   // how long a left/right glance is held
  const DWELL_MS = 110;   // zone must be stable this long before reacting
  const TAP_HOLD_MS = 4500;

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------------- copy ---------------- */

  const COPY = {
    work:  ['Working',       'Heads down in Xcode'],
    left:  ['Distracted',    'Anyone here on the left?'],
    right: ['Distracted',    'Anyone here on the right?'],
    hey:   ['Noticed you',   "Hey, it's you!"],
    hi:    ['Saying hi',     'Hiiii!'],
    point: ['Right this way', 'Check out the portfolio'],
  };

  let msgTimer;
  function say(key) {
    const [status, text] = COPY[key];
    hero.dataset.state = key;
    statusEl.textContent = status;
    cue.classList.toggle('is-called', key === 'point');
    if (messageEl.textContent === text) return;
    clearTimeout(msgTimer);
    messageEl.classList.remove('is-in');
    msgTimer = setTimeout(() => {
      messageEl.textContent = text;
      messageEl.classList.add('is-in');
    }, reduceMotion ? 0 : 220);
  }

  /* ---------------- SVG rig renderer ---------------- */

  function createRigRenderer() {
    const el = id => document.getElementById(id);
    const n = {
      rig: el('rig'), head: el('head'), face: el('face'),
      eyeGL: el('eyeGL'), eyeGR: el('eyeGR'), irisL: el('irisL'), irisR: el('irisR'),
      browL: el('browL'), browR: el('browR'), mouth: el('mouth'),
      cheekL: el('cheekL'), cheekR: el('cheekR'), glow: el('glow'), spill: el('spill'),
      armL: el('armL'), armR: el('armR'), armLHi: el('armLHi'), armRHi: el('armRHi'), handL: el('handL'), handR: el('handR'), finger: el('finger'),
      headset: el('headset'), band: el('band'), bandInner: el('bandInner'), boom: el('boom'),
      cupL: el('cupL'), cupR: el('cupR'),
    };

    // Working at the laptop. Hands rest behind the lid (hidden by it).
    const BASE = {
      turn: 0, tilt: 0, lift: 0, lean: 0,
      eyeX: 0, eyeY: .8, wide: 0, brow: 0, smile: .15, open: 0, blush: 0,
      hs: 0, grip: 0, wave: 0, point: 0, type: 1,
      lx: 262, ly: 466, lex: 206, ley: 392, lr: 0,
      rx: 378, ry: 466, rex: 434, rey: 392, rr: 0,
    };
    const look = side => {
      const s = side === 'left' ? -1 : 1;
      return { turn: s, tilt: s * 3, lean: s * .8, lift: -3, eyeX: s, eyeY: -.15,
               brow: .6, smile: .1, open: .22, type: 0, ly: 452, ry: 452 };
    };
    // Headset keyframes: on the head -> lifted clear -> resting around the neck.
    const HS = [
      { lx: 261, ly: 186, rx: 379, ry: 186, top: 42,  rot: 0 },
      { lx: 250, ly: 128, rx: 390, ry: 128, top: 8,   rot: 0 },
      { lx: 284, ly: 270, rx: 356, ry: 270, top: 300, rot: 62 },
    ];
    const NECK_ARMS = { lex: 214, ley: 330, rex: 426, rey: 330 };

    const GREET = [
      { ms: 650, beat: 'hey', pose: { turn: 0, tilt: 0, lean: 0, eyeX: 0, eyeY: -.05, wide: 1, brow: 1,
                                      smile: .2, open: .55, type: 0, lift: -6, ly: 448, ry: 448 } },
      { ms: 550, pose: { wide: .6, brow: .8, smile: 1, open: .7, blush: .6, lift: -8, tilt: -2 } },
      { ms: 480, pose: { grip: 1, lex: 196, ley: 268, rex: 444, rey: 268, tilt: 0 } },
      { ms: 520, pose: { hs: .5, lift: -4, open: .3, smile: .8 } },
      { ms: 600, pose: { hs: 1, ...NECK_ARMS } },
      { ms: 1900, beat: 'hi', pose: { grip: 0, wave: 1, smile: 1, open: .85, blush: .5, tilt: -4,
                                      lx: 184, ly: 190, lex: 170, ley: 292, lr: -8,
                                      rx: 378, ry: 448, rex: 434, rey: 392 } },
      { ms: 700, beat: 'point', pose: { wave: 0, point: 1, smile: .9, open: .35, tilt: 5, eyeX: .55, eyeY: .55,
                                        brow: .4, lr: 0, lx: 262, ly: 452, lex: 206, ley: 392,
                                        rx: 498, ry: 302, rex: 458, rey: 258, rr: -10 } },
    ];
    const HEADSET_BACK_ON = [
      { ms: 480, pose: { wave: 0, point: 0, grip: 1, ...NECK_ARMS, smile: .4, open: 0, tilt: 0,
                         eyeX: 0, eyeY: .3, wide: 0, brow: 0, lr: 0, rr: 0, blush: .3 } },
      { ms: 480, pose: { hs: .5, lex: 196, ley: 268, rex: 444, rey: 268 } },
      { ms: 460, pose: { hs: 0 } },
    ];

    const pose = { ...BASE };
    const target = { ...BASE };
    let runId = 0;
    let nextBlink = 2;
    let blinkAt = -1;

    function run(steps, onBeat, onDone) {
      const id = ++runId;
      let i = 0;
      (function next() {
        if (id !== runId) return;
        if (i >= steps.length) return onDone && onDone();
        const step = steps[i++];
        Object.assign(target, step.pose);
        if (step.beat && onBeat) onBeat(step.beat);
        setTimeout(next, step.ms);
      })();
    }

    function headsetAt(hs) {
      const [a, b, t] = hs <= .5 ? [HS[0], HS[1], hs * 2] : [HS[1], HS[2], (hs - .5) * 2];
      const o = {};
      for (const k in a) o[k] = lerp(a[k], b[k], t);
      return o;
    }

    function tick(dt, t) {
      const k = 1 - Math.exp(-dt * (reduceMotion ? 30 : 9));
      for (const key in target) pose[key] += (target[key] - pose[key]) * k;
      const p = pose;

      // blink
      if (t > nextBlink) { blinkAt = t; nextBlink = t + 2.4 + Math.random() * 2.8; }
      const bp = (t - blinkAt) / .15;
      const lid = bp >= 0 && bp <= 1 ? 1 - Math.sin(Math.PI * bp) * .92 : 1;

      const motion = reduceMotion ? 0 : 1;
      const breathe = Math.sin(t * 1.7) * .7 * motion;
      const bob = Math.sin(t * 2.3) * .8 * p.type * motion;
      n.rig.setAttribute('transform', `translate(${p.lean * 6} ${breathe})`);

      const hx = p.turn * 9;
      const hy = p.lift + bob;
      n.head.setAttribute('transform', `translate(${hx} ${hy}) rotate(${p.tilt} 320 236)`);
      n.face.setAttribute('transform', `translate(${p.turn * 10} 0)`);

      // eyes: irises scan the screen while working; the eye groups scale to blink
      const ex = (p.eyeX + Math.sin(t * .9) * .35 * p.type * motion) * 3.2;
      const ey = p.eyeY * 2.2;
      const squint = p.smile * .3 * (1 - p.wide);
      const open = (1 + p.wide * .18) * (1 - squint) * lid;
      const blink = cy => `translate(0 ${cy}) scale(1 ${open}) translate(0 ${-cy})`;
      n.eyeGL.setAttribute('transform', blink(182.5));
      n.eyeGR.setAttribute('transform', blink(182.5));
      n.irisL.setAttribute('transform', `translate(${ex} ${ey})`);
      n.irisR.setAttribute('transform', `translate(${ex} ${ey})`);

      const brow = -p.brow * 6 + p.eyeY;
      n.browL.setAttribute('transform', `translate(0 ${brow - Math.max(0, -p.turn) * 2})`);
      n.browR.setAttribute('transform', `translate(0 ${brow - Math.max(0, p.turn) * 2})`);

      const w = 11 + p.smile * 4 + p.open;
      // full lips at rest; opening the mouth drops the lower lip and darkens it
      const cy = 224.5 - p.smile * 2;
      const bottom = 231 + p.smile * 2 + p.open * 9;
      const top = 221.5 + p.smile * 2.5;
      n.mouth.setAttribute('d', `M${320 - w} ${cy} Q320 ${top} ${320 + w} ${cy} Q320 ${bottom} ${320 - w} ${cy} Z`);
      n.mouth.setAttribute('fill', p.open > .3 ? '#4a1e22' : '#a4605a');
      n.cheekL.setAttribute('opacity', p.blush);
      n.cheekR.setAttribute('opacity', p.blush);
      n.glow?.setAttribute('opacity', .85 + Math.sin(t * 7) * .05 * p.type * motion);

      // headset follows the head only while it's being worn
      const h = headsetAt(p.hs);
      const worn = 1 - clamp(p.hs * 2);
      const neck = clamp((p.hs - .5) * 2);
      n.headset.setAttribute('transform', `translate(${hx * worn} ${hy * worn}) rotate(${p.tilt * worn} 320 236)`);
      n.cupL.setAttribute('transform', `translate(${h.lx} ${h.ly}) rotate(${-h.rot})`);
      n.cupR.setAttribute('transform', `translate(${h.rx} ${h.ry}) rotate(${h.rot})`);
      const off = 16 * (1 - neck);
      const band = `M${h.lx} ${h.ly - off} C${h.lx - 4} ${h.top} ${h.rx + 4} ${h.top} ${h.rx} ${h.ry - off}`;
      n.band.setAttribute('d', band);
      n.bandInner.setAttribute('d', band);
      n.boom?.setAttribute('d', `M${h.lx} ${h.ly + 12} q7 34 39 26`);
      n.boom?.setAttribute('opacity', worn);

      // hands: posed, or locked to the cups while gripping the headset
      const cLx = h.lx + hx * worn, cLy = h.ly + hy * worn;
      const cRx = h.rx + hx * worn, cRy = h.ry + hy * worn;
      const typeL = p.type * motion, wave = p.wave * motion;
      const lx = lerp(p.lx, cLx - 3, p.grip) + Math.sin(t * 19) * 2.5 * typeL + Math.sin(t * 9) * 6 * wave;
      const ly = lerp(p.ly, cLy + 6, p.grip) + Math.sin(t * 27 + 1) * 3 * typeL;
      const rx = lerp(p.rx, cRx + 3, p.grip) + Math.sin(t * 21 + 2) * 2.5 * typeL;
      const ry2 = lerp(p.ry, cRy + 6, p.grip) + Math.sin(t * 25 + 3) * 3 * typeL;
      n.handL.setAttribute('transform', `translate(${lx} ${ly}) rotate(${p.lr + Math.sin(t * 9) * 22 * wave})`);
      n.handR.setAttribute('transform', `translate(${rx} ${ry2}) rotate(${p.rr})`);
      n.finger.setAttribute('opacity', p.point);
      const armL = `M236 292 Q${p.lex} ${p.ley} ${lx} ${ly}`;
      const armR = `M404 292 Q${p.rex} ${p.rey} ${rx} ${ry2}`;
      n.armL.setAttribute('d', armL);
      n.armLHi?.setAttribute('d', armL);
      n.armR.setAttribute('d', armR);
      n.armRHi?.setAttribute('d', armR);
    }

    return {
      tick,
      work() {
        const back = [{ ms: 0, pose: { ...BASE } }];
        run(target.hs > .05 ? [...HEADSET_BACK_ON, ...back] : back);
      },
      glance(side) {
        // a glance never touches the headset — if it's around the neck it stays there
        run([{ ms: 0, pose: { wave: 0, point: 0, grip: 0, lr: 0, rr: 0, wide: 0, blush: .2, ...look(side) } }]);
      },
      greet(onBeat, onDone) { run(GREET, onBeat, onDone); },
      destroy() { runId++; },
    };
  }

  /* ---------------- video-frame renderer ---------------- */

  async function createFrameRenderer() {
    const res = await fetch('frames/manifest.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('no frames manifest');
    const m = await res.json();
    if (m.mode === 'keyframes') return createKeyframeRenderer(m);
    const fps = m.fps || 24;
    const seg = m.segments;
    const pad = m.pad || 4;
    const imgs = [];
    const first = m.first ?? 1; // ffmpeg numbers its output from 1
    const url = i => 'frames/' + m.pattern.replace('{i}', String(i + first).padStart(pad, '0'));
    const load = i => {
      if (imgs[i]) return imgs[i].ready;
      const img = new Image();
      img.decoding = 'async';
      img.src = url(i);
      img.ready = img.decode().then(() => { img.ok = true; }, () => {});
      imgs[i] = img;
      return img.ready;
    };
    const range = ([a, b]) => Array.from({ length: b - a + 1 }, (_, j) => a + j);

    // the working loop must be ready before we swap in; the rest streams in after
    await Promise.all(range(seg.work).map(load));
    const loadRest = () => { for (let i = 0; i < m.count; i++) load(i); };
    'requestIdleCallback' in window ? requestIdleCallback(loadRest) : setTimeout(loadRest, 300);

    const g = seg.greet;
    const beats = m.beats || {
      hey: g[0],
      hi: Math.round(lerp(g[0], g[1], .55)),
      point: Math.round(lerp(g[0], g[1], .85)),
    };

    const ctx = canvas.getContext('2d');
    canvas.style.aspectRatio = `${m.width || 16} / ${m.height || 9}`;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      drawn = -1;
    };

    let frame = seg.work[0];
    let dir = 1;
    let motion = { loop: seg.work };
    let drawn = -1;
    let fadeFrom = null;
    let fadeT = 1;
    let onBeat = null;

    function jump(to) {
      if (Math.abs(to - frame) > 2 && imgs[Math.round(frame)] && imgs[Math.round(frame)].ok) {
        fadeFrom = imgs[Math.round(frame)];
        fadeT = 0;
      }
      frame = to;
    }
    function seek(to, speed, done) { motion = { to, speed, done }; }
    function segmentOf(f) {
      for (const key of ['left', 'right', 'greet']) if (f >= seg[key][0] && f <= seg[key][1]) return key;
      return 'work';
    }

    function paint(img, alpha) {
      const cw = canvas.width, ch = canvas.height;
      const s = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
      const w = img.naturalWidth * s, h = img.naturalHeight * s;
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
    }

    function tick(dt) {
      const prev = frame;
      if (motion.loop) {
        // ping-pong so the working loop never visibly wraps
        frame += fps * dt * dir;
        if (frame >= motion.loop[1]) { frame = motion.loop[1]; dir = -1; }
        if (frame <= motion.loop[0]) { frame = motion.loop[0]; dir = 1; }
      } else if (motion.to != null) {
        const d = Math.sign(motion.to - frame);
        frame += d * fps * motion.speed * dt;
        if ((motion.to - frame) * d <= 0) {
          frame = motion.to;
          const done = motion.done;
          motion = {};
          if (done) done();
        }
      }
      if (onBeat) for (const key in beats) if (prev < beats[key] && frame >= beats[key]) onBeat(key);

      const i = Math.round(frame);
      const img = imgs[i];
      if (fadeT < 1) fadeT = Math.min(1, fadeT + dt / .18);
      if ((i === drawn && fadeT >= 1) || !img || !img.ok) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (fadeT < 1 && fadeFrom) paint(fadeFrom, 1);
      paint(img, fadeT < 1 ? fadeT : 1);
      ctx.globalAlpha = 1;
      drawn = i;
    }

    // swap in
    svg.style.display = 'none';
    canvas.hidden = false;
    stage.classList.add('is-frames');
    resize();
    new ResizeObserver(resize).observe(canvas);

    return {
      tick,
      work() {
        onBeat = null;
        const cur = segmentOf(Math.round(frame));
        if (cur === 'work') { motion = { loop: seg.work }; return; }
        // play the reaction backwards to where it left the working loop
        seek(seg[cur][0], cur === 'greet' ? 2.4 : 1.6, () => {
          jump(seg.work[1]);
          dir = -1;
          motion = { loop: seg.work };
        });
      },
      glance(side) {
        onBeat = null;
        jump(seg[side][0]);
        seek(seg[side][1], 1);
      },
      greet(beat, done) {
        onBeat = beat;
        jump(seg.greet[0]);
        seek(seg.greet[1], 1, () => { onBeat = null; if (done) done(); });
      },
      destroy() {},
    };
  }

  /* ---------------- keyframe renderer ---------------- */

  // A handful of stills (e.g. AI-generated 3D renders), cross-faded per state.
  // Every image is decoded up front and stays in the DOM, and a new frame fades in
  // on top of a fully opaque previous frame, so a switch never dips or flashes.
  async function createKeyframeRenderer(m) {
    const list = key => [].concat(m.frames[key] || []);
    const urls = [...new Set(Object.keys(m.frames).flatMap(list))];
    const layer = document.createElement('div');
    layer.className = 'hero__kf';
    const deck = document.createElement('div');   // frames stack; the lid decoration sits above it
    deck.className = 'hero__kf-frames';
    layer.append(deck);
    const els = {};
    await Promise.all(urls.map(u => {
      const img = new Image();
      img.alt = '';
      img.src = 'frames/' + u;
      els[u] = img;
      deck.append(img);
      return img.decode();
    }));

    let current = null;
    let z = 1;
    let cleanup, cycleTimer, seqTimers = [];

    function show(url, fade = 480) {
      const next = els[url];
      if (!next || next === current) return;
      const prev = current;
      current = next;
      next.style.zIndex = ++z;
      next.style.transitionDuration = (reduceMotion ? 0 : fade) + 'ms';
      next.classList.add('is-on');
      clearTimeout(cleanup);
      // once the new frame is fully opaque, hide everything underneath it
      cleanup = setTimeout(() => {
        for (const u in els) if (els[u] !== current) {
          els[u].style.transitionDuration = '0ms';
          els[u].classList.remove('is-on');
        }
      }, fade + 60);
      return prev;
    }
    function play(key, { every = 0, fade = 480, cycleFade = fade } = {}) {
      clearInterval(cycleTimer);
      const frames = list(key);
      let i = 0;
      show(frames[0], fade);
      if (every && frames.length > 1 && !reduceMotion) {
        cycleTimer = setInterval(() => show(frames[++i % frames.length], cycleFade), every);
      }
    }
    function stop() {
      clearInterval(cycleTimer);
      seqTimers.forEach(clearTimeout);
      seqTimers = [];
    }
    const WORK = { every: 3400, fade: 520, cycleFade: 1100 };

    const lidDecor = stage.querySelector('[data-lid]');
    if (lidDecor) { lidDecor.removeAttribute('hidden'); layer.append(lidDecor); } // SVG has no .hidden property

    svg.style.display = 'none';
    stage.classList.add('is-frames');
    stage.append(layer);
    play('work', { ...WORK, fade: 0 });

    return {
      tick() {},
      work() { stop(); play('work', WORK); },
      glance(side) { stop(); play(side, { fade: 420 }); },
      greet(onBeat, onDone) {
        stop();
        const at = (ms, fn) => seqTimers.push(setTimeout(fn, ms));
        play('hey', { fade: 360 }); onBeat('hey');
        at(1150, () => { play('hi', { every: 720, fade: 420, cycleFade: 380 }); onBeat('hi'); });
        at(3300, () => { play('point', { fade: 520 }); onBeat('point'); if (onDone) onDone(); });
      },
      destroy() { stop(); },
    };
  }

  /* ---------------- controller ---------------- */

  let renderer = createRigRenderer();
  let mode = 'work';
  let zone = null;
  let pending = null;
  let dwellTimer, holdTimer, leaveTimer;

  function toWork() {
    clearTimeout(holdTimer);
    if (mode === 'work') return;
    mode = 'work';
    renderer.work();
    say('work');
  }

  function glance(side) {
    clearTimeout(holdTimer);
    mode = side;
    renderer.glance(side);
    say(side);
    holdTimer = setTimeout(toWork, HOLD_MS);
  }

  function greet(autoReturn) {
    clearTimeout(holdTimer);
    if (mode === 'greet') return;
    mode = 'greet';
    renderer.greet(
      beat => { if (mode === 'greet') say(beat); },
      () => { if (autoReturn && mode === 'greet') holdTimer = setTimeout(toWork, TAP_HOLD_MS); },
    );
  }

  function zoneAt(clientX) {
    const r = hero.getBoundingClientRect();
    const x = (clientX - r.left) / r.width;
    return x < 1 / 3 ? 'left' : x > 2 / 3 ? 'right' : 'center';
  }

  function enterZone(z) {
    if (z === zone) return;
    zone = z;
    if (z === 'center') greet(false);
    else glance(z);
  }

  hero.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || touchLayout.matches) return;
    clearTimeout(leaveTimer);
    const z = zoneAt(e.clientX);
    hero.dataset.zone = z;
    if (z === pending) return;
    pending = z;
    clearTimeout(dwellTimer);
    dwellTimer = setTimeout(() => enterZone(z), DWELL_MS);
  }, { passive: true });

  hero.addEventListener('pointerleave', e => {
    if (e.pointerType !== 'mouse') return;
    clearTimeout(dwellTimer);
    pending = null;
    leaveTimer = setTimeout(() => {
      zone = null;
      delete hero.dataset.zone;
      if (mode === 'greet') toWork();
    }, 1400);
  });

  // tap / keyboard: the center greeting only
  const activate = () => (mode === 'greet' ? toWork() : greet(true));
  stage.addEventListener('click', () => {
    if (touchLayout.matches) activate(); // desktop mice use the zones instead
  });
  stage.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    activate();
  });

  /* ---------------- frame loop ---------------- */

  let raf = 0;
  let last = 0;
  let inView = true;
  let greetedOnTouch = false;

  function loop(now) {
    const dt = last ? Math.min(.05, (now - last) / 1000) : 0;
    last = now;
    renderer.tick(dt, now / 1000);
    raf = requestAnimationFrame(loop);
  }
  function setRunning(on) {
    if (on && !raf) { last = 0; raf = requestAnimationFrame(loop); }
    if (!on && raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    setRunning(inView && !document.hidden);
    // on phones there are no zones — say hi once when the hero is first seen
    if (inView && touchLayout.matches && !greetedOnTouch) {
      greetedOnTouch = true;
      setTimeout(() => { if (mode === 'work') greet(true); }, 1200);
    }
  }).observe(hero);
  document.addEventListener('visibilitychange', () => setRunning(inView && !document.hidden));

  say('work');

  // Upgrade to real video frames when they've been added to the project.
  createFrameRenderer().then(frames => {
    renderer.destroy();
    renderer = frames;
    mode = 'work';
    say('work');
  }, () => { /* no frames yet: keep the SVG rig */ });
})();
