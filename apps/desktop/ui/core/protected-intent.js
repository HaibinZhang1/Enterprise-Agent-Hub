export function createRouteIntent(pageId) {
  return {
    type: 'route',
    pageId,
    label: `继续访问 ${pageId}`,
  };
}

export function createActionIntent(actionId, route, label, meta = {}) {
  return {
    type: 'action',
    actionId,
    route,
    label,
    meta,
  };
}

export function setPendingIntent(store, intent) {
  store.setState((state) => ({
    ...state,
    pendingIntent: intent,
  }));
}

export function clearPendingIntent(store) {
  store.setState((state) => ({
    ...state,
    pendingIntent: null,
  }));
}

export function takePendingIntent(store) {
  const intent = store.getState().pendingIntent;
  clearPendingIntent(store);
  return intent;
}

export function openLoginPrompt(store, intent, message, title = '登录企业内网账号') {
  store.setState((state) => ({
    ...state,
    pendingIntent: intent ?? state.pendingIntent,
    dialog: {
      type: 'login',
      title,
      message,
      status: '请输入企业内网账号继续。',
    },
    userMenuOpen: false,
  }));
}
