import assert from "node:assert/strict";
import test from "node:test";
import { createActivateHandler, trackMainWindowLifecycle, type TrackableWindowLike } from "../src-electron/windowLifecycle.ts";

type TestWindow = TrackableWindowLike & {
  emitClosed(): void;
};

function createTrackedWindow(): TestWindow {
  let closedListener: (() => void) | undefined;
  return {
    on(event, listener) {
      if (event === "closed") {
        closedListener = listener;
      }
    },
    emitClosed() {
      closedListener?.();
    }
  };
}

test("tracked main window clears the stored reference after close", () => {
  const window = createTrackedWindow();
  let currentWindow: TrackableWindowLike | null = window;
  trackMainWindowLifecycle(window, (next) => {
    currentWindow = next;
  });
  window.emitClosed();
  assert.equal(currentWindow, null);
});

test("activate recreates the desktop window only after the previous window closes", async () => {
  const firstWindow = createTrackedWindow();
  const secondWindow = createTrackedWindow();
  let currentWindow: TestWindow | null = firstWindow;
  let createCount = 0;
  let attachedWindow: TestWindow | null = null;

  trackMainWindowLifecycle(firstWindow, (next) => {
    currentWindow = next as TestWindow | null;
  });

  const onActivate = createActivateHandler(
    () => currentWindow,
    async () => {
      createCount += 1;
      return secondWindow;
    },
    (next) => {
      currentWindow = next as TestWindow | null;
    },
    (next) => {
      attachedWindow = next;
      trackMainWindowLifecycle(next, (later) => {
        currentWindow = later as TestWindow | null;
      });
    }
  );

  onActivate();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(createCount, 0);

  firstWindow.emitClosed();
  assert.equal(currentWindow, null);

  onActivate();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(createCount, 1);
  assert.equal(currentWindow, secondWindow);
  assert.equal(attachedWindow, secondWindow);

  secondWindow.emitClosed();
  assert.equal(currentWindow, null);
});
