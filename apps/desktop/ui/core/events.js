import { computeReviewTodoCount, computeUnreadCount } from './utils.js';

export function createEventsController({ store, refresh, getSession }) {
  let source = null;
  const feed = [];

  function close() {
    if (source) {
      source.close();
      source = null;
    }
  }

  function pushFeed(type, payload) {
    feed.unshift({
      at: new Date().toISOString(),
      payload,
      type,
    });
    store.setState((state) => ({
      ...state,
      eventFeed: feed.slice(0, 12),
    }));
  }

  function connect() {
    if (!getSession()?.user) {
      close();
      store.setState((state) => ({
        ...state,
        realtime: { status: 'idle', message: 'Sign in to start realtime desktop updates.' },
      }));
      return;
    }

    close();
    store.setState((state) => ({
      ...state,
      realtime: { status: 'connecting', message: 'Connecting realtime stream…' },
    }));

    source = new EventSource('/api/events');
    const eventNames = ['notify.badge.updated', 'review.queue.updated', 'install.update-available', 'sse.reconnect-required'];

    for (const eventName of eventNames) {
      source.addEventListener(eventName, async (event) => {
        const payload = JSON.parse(event.data);
        pushFeed(eventName, payload);

        if (eventName === 'notify.badge.updated') {
          store.setState((state) => ({
            ...state,
            notificationBadge: payload.unreadCount ?? computeUnreadCount(payload.items ?? []),
          }));
          await refresh.invalidate(['home', 'notifications'], eventName);
        }

        if (eventName === 'review.queue.updated') {
          store.setState((state) => ({
            ...state,
            reviewBadge: computeReviewTodoCount(payload.queue ?? payload),
          }));
          await refresh.invalidate(['home', 'review'], eventName);
        }
      });
    }

    source.onopen = () => {
      store.setState((state) => ({
        ...state,
        realtime: { status: 'online', message: 'Realtime notifications connected.' },
      }));
    };

    source.onerror = () => {
      store.setState((state) => ({
        ...state,
        realtime: { status: 'degraded', message: 'Realtime connection interrupted. Waiting for reconnect…' },
      }));
    };
  }

  return Object.freeze({
    close,
    connect,
  });
}
