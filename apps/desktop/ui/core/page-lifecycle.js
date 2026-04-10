export function createPageModule({ id, render }) {
  let host = null;
  let revision = 0;
  let lastContext = null;

  function makeScope() {
    const token = ++revision;
    return Object.freeze({
      token,
      isActive() {
        return token === revision;
      },
    });
  }

  const page = {
    id,
    mount(container) {
      host = container;
    },
    async enter(context) {
      lastContext = context;
      const scope = makeScope();
      if (!host) {
        return;
      }
      await render({
        host,
        context,
        scope,
      });
    },
    leave() {
      revision += 1;
      if (host) {
        host.innerHTML = '';
      }
    },
    async invalidate(reason) {
      if (!lastContext) {
        return;
      }
      await page.enter({ ...lastContext, reason });
    },
    dispose() {
      page.leave();
      host = null;
      lastContext = null;
    },
  };

  return Object.freeze(page);
}
