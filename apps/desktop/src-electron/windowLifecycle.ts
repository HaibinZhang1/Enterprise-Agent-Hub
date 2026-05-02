export type TrackableWindowLike = {
  on?(event: "closed", listener: () => void): void;
};

export function trackMainWindowLifecycle(
  window: TrackableWindowLike,
  setMainWindow: (window: TrackableWindowLike | null) => void
): void {
  window.on?.("closed", () => {
    setMainWindow(null);
  });
}

export function createActivateHandler<TWindow>(
  getMainWindow: () => TWindow | null,
  createWindow: () => Promise<TWindow>,
  setMainWindow: (window: TWindow | null) => void,
  afterCreate?: (window: TWindow) => void
): () => void {
  return () => {
    if (getMainWindow()) return;
    void createWindow().then((window) => {
      setMainWindow(window);
      afterCreate?.(window);
    });
  };
}
