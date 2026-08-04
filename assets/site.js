// Shared across all pages: footer year, mobile nav, scroll reveal.
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

const navToggle = document.getElementById('navToggle');
const mobilePanel = document.getElementById('mobilePanel');
if (navToggle && mobilePanel) {
  navToggle.addEventListener('click', () => {
    const open = mobilePanel.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  mobilePanel.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    mobilePanel.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  }));
}

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const revealEls = document.querySelectorAll('.reveal');
if (reduceMotion) {
  revealEls.forEach(el => el.classList.add('is-visible'));
} else {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
  revealEls.forEach(el => io.observe(el));
}
