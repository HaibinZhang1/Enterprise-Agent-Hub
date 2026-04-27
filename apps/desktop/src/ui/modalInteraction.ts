export function shouldCloseFromBackdropPointerDown(event: { target: EventTarget | null; currentTarget: EventTarget | null }): boolean {
  return event.target === event.currentTarget;
}
