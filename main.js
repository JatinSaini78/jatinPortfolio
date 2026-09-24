/* Page behaviour outside the hero: nav, reveals, pipeline, RTL mock, contact. */
(() => {
  'use strict';

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  /* footer year */
  const year = $('[data-year]');
  if (year) year.textContent = new Date().getFullYear();

  /* nav: solid background once the page scrolls */
  const nav = $('[data-nav]');
  let ticking = false;
  const syncNav = () => {
    nav.classList.toggle('is-scrolled', window.scrollY > 12);
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(syncNav); }
  }, { passive: true });
  syncNav();

  /* reveal on scroll, staggered within each parent */
  const reveals = $$('.reveal');
  const groups = new Map();
  reveals.forEach(node => {
    const i = groups.get(node.parentElement) || 0;
    node.style.setProperty('--d', `${Math.min(i, 6) * 80}ms`);
    groups.set(node.parentElement, i + 1);
  });

  const steps = $('[data-steps]');

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .12 });
    reveals.forEach(node => io.observe(node));

    /* pipeline: light each step up in order */
    if (steps) {
      const sio = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        $$('.step', steps).forEach((step, i) => setTimeout(() => step.classList.add('is-on'), 180 * i));
        sio.disconnect();
      }, { threshold: .35 });
      sio.observe(steps);
    }
  } else {
    reveals.forEach(node => node.classList.add('is-visible'));
    if (steps) $$('.step', steps).forEach(step => step.classList.add('is-on'));
  }

  /* project showcases: real screens, auto-playing; tall screens scroll inside the phone */
  $$('[data-showcase]').forEach(showcase => {
    const shots = $$('[data-shot]', showcase);
    const buttons = $$('[data-shot-btn]', showcase);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let index = 0;
    let timer;

    const select = i => {
      index = (i + shots.length) % shots.length;
      shots.forEach((img, j) => {
        const on = j === index;
        img.classList.toggle('is-on', on);
        if (on && img.classList.contains('shot--tall')) {
          // scroll the long screen's content from top to bottom while it's shown
          const body = img.querySelector('.shot__body');
          const travel = Math.max(0, body.offsetHeight - img.clientHeight); // layout size: the phone is rotated
          img.style.setProperty('--travel', `-${travel}px`);
          img.classList.remove('is-scrolling');
          void img.offsetWidth;
          if (!reduce) img.classList.add('is-scrolling');
        }
      });
      buttons.forEach((b, j) => {
        b.classList.toggle('is-on', j === index);
        b.setAttribute('aria-selected', String(j === index));
      });
    };
    const dwell = () => (shots[index].classList.contains('shot--tall') ? 8800 : 3200); // scroll ends ~6.3s, then a pause
    const schedule = () => {
      clearTimeout(timer);
      if (!reduce) timer = setTimeout(() => { select(index + 1); schedule(); }, dwell());
    };

    buttons.forEach((b, j) => b.addEventListener('click', () => { select(j); schedule(); }));
    showcase.addEventListener('pointerenter', () => clearTimeout(timer));
    showcase.addEventListener('pointerleave', schedule);
    // only play while visible
    new IntersectionObserver(([e]) => (e.isIntersecting ? schedule() : clearTimeout(timer)), { threshold: .3 }).observe(showcase);
    select(0);
  });

  /* code viewer tabs */
  const code = $('[data-code]');
  if (code) {
    const tabs = $$('[data-code-tab]', code);
    const panes = $$('[data-code-pane]', code);
    tabs.forEach(tab => tab.addEventListener('click', () => {
      tabs.forEach(t => { const on = t === tab; t.classList.toggle('is-on', on); t.setAttribute('aria-selected', String(on)); });
      panes.forEach(p => { p.hidden = p.dataset.codePane !== tab.dataset.codeTab; });
    }));
  }

  /* copy email */
  const toast = $('[data-toast]');
  let toastTimer;
  const showToast = text => {
    toast.textContent = text;
    toast.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-show'), 2200);
  };
  $$('[data-copy]').forEach(button => button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      showToast('Email copied to clipboard');
    } catch {
      showToast(button.dataset.copy);
    }
  }));
})();
