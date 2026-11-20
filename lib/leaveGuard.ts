// Lets a page that must not be left abruptly (a live call) intercept the global Home button.
// Uses a cancelable window event instead of shared module state, so it keeps working even when
// hot reload or code splitting gives the Home button and the page separate copies of this module.

export const LEAVE_REQUEST = "app:leave-request";

/** Asks the current page whether it is fine to leave. Returns false if the page took over. */
export function requestLeave(): boolean {
  return window.dispatchEvent(new Event(LEAVE_REQUEST, { cancelable: true }));
}
