import { canAccessPage, getSafeFallback } from './page-registry.js';

export function parseHashRoute(hashValue) {
  const hash = String(hashValue ?? '').replace(/^#/, '').trim();
  if (!hash) {
    return { pageId: 'home' };
  }
  const [pageId] = hash.split('?');
  return { pageId: pageId || 'home' };
}

export function resolvePageRoute(hashValue, session) {
  const parsed = parseHashRoute(hashValue);
  if (canAccessPage(parsed.pageId, session)) {
    return parsed.pageId;
  }
  return getSafeFallback(parsed.pageId, session);
}

export function createRouter({ onRouteChange, getSession }) {
  function currentPage() {
    return resolvePageRoute(window.location.hash, getSession());
  }

  function applyRoute(replace = false) {
    const target = currentPage();
    const nextHash = `#${target}`;
    if (window.location.hash !== nextHash) {
      if (replace) {
        window.history.replaceState(null, '', nextHash);
      } else {
        window.location.hash = nextHash;
        return;
      }
    }
    onRouteChange(target);
  }

  function navigate(pageId, { replace = false } = {}) {
    const target = canAccessPage(pageId, getSession()) ? pageId : getSafeFallback(pageId, getSession());
    if (replace) {
      window.history.replaceState(null, '', `#${target}`);
      onRouteChange(target);
      return;
    }
    if (window.location.hash === `#${target}`) {
      onRouteChange(target);
      return;
    }
    window.location.hash = `#${target}`;
  }

  function start() {
    window.addEventListener('hashchange', () => applyRoute(false));
    applyRoute(true);
  }

  return Object.freeze({
    currentPage,
    navigate,
    start,
  });
}
