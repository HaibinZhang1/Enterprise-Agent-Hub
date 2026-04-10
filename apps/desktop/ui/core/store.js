function cloneState(state) {
  return structuredClone(state);
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
