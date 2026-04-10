function cloneState(state) {
  return structuredClone(state);
}

export function createDesktopShellState() {
  return {
    route: 'home',
    session: null,
    searchQuery: '',
    dialog: null,
    preview: null,
    pendingIntent: null,
    userMenuOpen: false,
    managementTab: 'departments',
    notificationBadge: 0,
    reviewBadge: 0,
    health: {
      status: 'checking',
      label: 'Checking…',
      detail: 'Waiting for the desktop shell health check.',
      apiBaseUrl: 'Not loaded',
    },
    realtime: {
      status: 'idle',
      message: 'Sign in to start realtime desktop updates.',
    },
    flash: null,
    eventFeed: [],
    local: {
      tools: { status: 'idle', items: [], message: 'Scan the machine to load writable-path health for the desktop toolchain.' },
      projects: {
        status: 'idle',
        items: [],
        currentProjectId: null,
        message: 'Register a local project path to start multi-project management.',
      },
      settings: { status: 'idle', data: null, message: 'Desktop settings will appear here after the local shell loads.' },
    },
    remote: {
      market: { status: 'idle', results: [], message: 'Sign in to browse the market.' },
      mySkills: { status: 'idle', items: [], message: 'Sign in to load your skills.' },
      notifications: { status: 'idle', items: [], message: 'Notification status will appear after sign in.' },
      review: { status: 'idle', queue: null, message: 'Review actions unlock for review_admin and system_admin roles.' },
      management: { status: 'idle', skills: [], message: 'Administrator-only management modules appear here.' },
    },
  };
}

export function createStore(initialState) {
  let state = cloneState(initialState);
  const listeners = new Set();

  function getState() {
    return state;
  }

  function setState(updater) {
    const nextState = typeof updater === 'function' ? updater(state) : { ...state, ...updater };
    state = nextState;
    for (const listener of listeners) {
      listener(state);
    }
    return state;
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return Object.freeze({
    getState,
    setState,
    subscribe,
  });
}
