import { canAccessPage, getProtectedPrompt, getSafeFallback, requiresAuthentication } from './page-registry.js';
import { createRouteIntent } from './protected-intent.js';

export function parseHashRoute(hashValue) {
  const hash = String(hashValue ?? '').replace(/^#/, '').trim();
  if (!hash) {
    return { pageId: 'home' };
  }
  const [pageId] = hash.split('?');
  return { pageId: pageId || 'home' };
}

export function resolveNavigationTarget(pageId, session) {
  const shouldPrompt = requiresAuthentication(pageId) && !session?.user;
  if (canAccessPage(pageId, session) && !shouldPrompt) {
    return { pageId, blocked: false, pendingIntent: null, prompt: null };
  }

  const fallback = getSafeFallback(pageId, session);
  return {
    pageId: fallback,
    blocked: shouldPrompt,
    pendingIntent: shouldPrompt ? createRouteIntent(pageId) : null,
    prompt: shouldPrompt ? getProtectedPrompt(pageId) : null,
  };
}

export function resolvePageRoute(hashValue, session) {
  const parsed = parseHashRoute(hashValue);
  return resolveNavigationTarget(parsed.pageId, session).pageId;
}

export function createRouter({ onRouteChange, onBlockedRoute, getSession }) {
  function applyRoute(replace = false) {
    const parsed = parseHashRoute(window.location.hash);
    const resolved = resolveNavigationTarget(parsed.pageId, getSession());
    const nextHash = `#${resolved.pageId}`;

    if (resolved.blocked) {
      onBlockedRoute?.(resolved);
    }

    if (window.location.hash !== nextHash) {
      if (replace) {
        window.history.replaceState(null, '', nextHash);
      } else {
        window.location.hash = nextHash;
        return;
      }
    }

    onRouteChange(resolved.pageId, { blocked: resolved.blocked, requestedPageId: parsed.pageId });
  }

  function navigate(pageId, { replace = false } = {}) {
    const resolved = resolveNavigationTarget(pageId, getSession());
    if (resolved.blocked) {
      onBlockedRoute?.(resolved);
    }

    const nextHash = `#${resolved.pageId}`;
    if (replace) {
      window.history.replaceState(null, '', nextHash);
      onRouteChange(resolved.pageId, { blocked: resolved.blocked, requestedPageId: pageId });
      return;
    }

    if (window.location.hash === nextHash) {
      onRouteChange(resolved.pageId, { blocked: resolved.blocked, requestedPageId: pageId });
      return;
    }

    window.location.hash = nextHash;
  }

  function start() {
    window.addEventListener('hashchange', () => applyRoute(false));
    applyRoute(true);
  }

  return Object.freeze({
    navigate,
    start,
    currentPage() {
      return resolvePageRoute(window.location.hash, getSession());
    },
  });
}
