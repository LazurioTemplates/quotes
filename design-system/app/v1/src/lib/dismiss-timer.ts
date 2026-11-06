// The auto-dismissal of a toast (content/components/toast.md): it leaves after
// `ms`, but never while the reader hovers it OR has focus inside it. Hover and
// focus are tracked separately, so ending one while the other holds keeps the
// toast; the timer starts again in full once both have ended.
export type Scheduler = { set(run: () => void, ms: number): number; clear(id: number): void };

export function dismissTimer(ms: number, close: () => void, scheduler: Scheduler) {
  let hovered = false;
  let focused = false;
  let pending: number | undefined;
  const update = () => {
    if (pending !== undefined) scheduler.clear(pending);
    pending = hovered || focused ? undefined : scheduler.set(close, ms);
  };
  update();
  return {
    hover(on: boolean) {
      hovered = on;
      update();
    },
    focus(on: boolean) {
      focused = on;
      update();
    },
    stop() {
      if (pending !== undefined) scheduler.clear(pending);
      pending = undefined;
    },
  };
}
