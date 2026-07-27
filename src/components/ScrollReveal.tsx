// Adds a subtle fade+rise animation to sections and cards as they scroll into view.
// Mounted once in App — no per-page edits needed.
import { useEffect } from 'react';

const SELECTORS = [
  'section',
  '.news-card',
  '.reveal-item',
].join(',');

export default function ScrollReveal() {
  useEffect(() => {
    // Respect users who prefer less motion — show everything immediately.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Without IntersectionObserver we would hide content with no way to show it.
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('reveal-in');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' },
    );

    // Scoped to this effect run so StrictMode's double-mount re-observes cleanly.
    const seen = new WeakSet<HTMLElement>();

    const tag = () => {
      document.querySelectorAll<HTMLElement>(SELECTORS).forEach(el => {
        if (seen.has(el)) return;
        // Skip fixed/sticky overlays (headers, banners, modals)
        const pos = getComputedStyle(el).position;
        if (pos === 'fixed' || pos === 'sticky') return;
        seen.add(el);
        // Already on screen (first paint / after navigation): show at once.
        // Animating these would only cause a fade-out-then-in flash.
        if (el.getBoundingClientRect().top < window.innerHeight * 0.9) {
          el.classList.add('reveal', 'reveal-in');
          return;
        }
        el.classList.add('reveal');
        observer.observe(el);
      });
    };

    tag();
    // Re-tag when new content streams in from Firestore
    const mo = new MutationObserver(() => tag());
    mo.observe(document.body, { childList: true, subtree: true });

    return () => { observer.disconnect(); mo.disconnect(); };
  }, []);

  return null;
}
