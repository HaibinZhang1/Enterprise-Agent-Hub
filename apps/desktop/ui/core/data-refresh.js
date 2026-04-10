export function createRefreshController({ pages, getCurrentRoute }) {
  const dirtyPages = new Set();

  async function invalidate(pageIds, reason) {
    for (const pageId of pageIds) {
      if (pageId === getCurrentRoute()) {
        await pages.get(pageId)?.invalidate(reason);
      } else {
        dirtyPages.add(pageId);
      }
    }
  }

  async function consume(pageId) {
    if (!dirtyPages.has(pageId)) {
      return;
    }
    dirtyPages.delete(pageId);
    await pages.get(pageId)?.invalidate('deferred-refresh');
  }

  return Object.freeze({
    consume,
    invalidate,
  });
}
