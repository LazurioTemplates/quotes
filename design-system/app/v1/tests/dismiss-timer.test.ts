import { describe, expect, test } from "bun:test";
import { dismissTimer, type Scheduler } from "../src/lib/dismiss-timer";

// A scheduler under the test's control: `advance(ms)` runs what is due.
function fakeScheduler() {
  let now = 0;
  let next = 1;
  const jobs = new Map<number, { at: number; run: () => void }>();
  const scheduler: Scheduler = {
    set(run, ms) {
      jobs.set(next, { at: now + ms, run });
      return next++;
    },
    clear(id) {
      jobs.delete(id);
    },
  };
  const advance = (ms: number) => {
    now += ms;
    for (const [id, job] of [...jobs]) {
      if (job.at <= now) {
        jobs.delete(id);
        job.run();
      }
    }
  };
  return { scheduler, advance };
}

describe("toast auto-dismissal", () => {
  test("leaves after the dismiss time when nobody hovers or focuses it", () => {
    const { scheduler, advance } = fakeScheduler();
    let closed = 0;
    dismissTimer(6000, () => closed++, scheduler);
    advance(5999);
    expect(closed).toBe(0);
    advance(1);
    expect(closed).toBe(1);
  });

  test("never leaves while hovered, and restarts in full after the pointer leaves", () => {
    const { scheduler, advance } = fakeScheduler();
    let closed = 0;
    const timer = dismissTimer(6000, () => closed++, scheduler);
    advance(5000);
    timer.hover(true);
    advance(60000);
    expect(closed).toBe(0);
    timer.hover(false);
    advance(5999);
    expect(closed).toBe(0);
    advance(1);
    expect(closed).toBe(1);
  });

  test("the pointer leaving while focus stays inside keeps the toast", () => {
    const { scheduler, advance } = fakeScheduler();
    let closed = 0;
    const timer = dismissTimer(6000, () => closed++, scheduler);
    timer.hover(true);
    timer.focus(true);
    timer.hover(false);
    advance(60000);
    expect(closed).toBe(0);
    timer.focus(false);
    advance(6000);
    expect(closed).toBe(1);
  });

  test("focus leaving while the pointer stays on it keeps the toast", () => {
    const { scheduler, advance } = fakeScheduler();
    let closed = 0;
    const timer = dismissTimer(6000, () => closed++, scheduler);
    timer.focus(true);
    timer.hover(true);
    timer.focus(false);
    advance(60000);
    expect(closed).toBe(0);
    timer.hover(false);
    advance(6000);
    expect(closed).toBe(1);
  });

  test("stop cancels a pending dismissal", () => {
    const { scheduler, advance } = fakeScheduler();
    let closed = 0;
    const timer = dismissTimer(6000, () => closed++, scheduler);
    timer.stop();
    advance(60000);
    expect(closed).toBe(0);
  });
});
