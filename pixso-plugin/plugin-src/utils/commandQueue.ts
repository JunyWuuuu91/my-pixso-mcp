/**
 * Serializes async command execution inside the plugin sandbox.
 * Pixso delivers every ui message through one async onmessage handler; without a
 * queue two overlapping commands can interleave their getNodeById reads and
 * out-of-order responses, which under rapid bulk reads contributes to window
 * freezes. The queue guarantees one command runs at a time and responses are
 * posted in dispatch order.
 */
export interface CommandQueue {
  run<T>(task: () => Promise<T> | T): Promise<T>;
  /** true while a queued task is still running */
  busy(): boolean;
  /** number of tasks waiting to start (excluding the running one) */
  pending(): number;
}

export function createCommandQueue(): CommandQueue {
  let tail: Promise<void> = Promise.resolve();
  let running = 0;
  let waiting = 0;

  return {
    run<T>(task: () => Promise<T> | T): Promise<T> {
      waiting += 1;
      const result = tail.then(async () => {
        waiting -= 1;
        running += 1;
        try {
          return await task();
        } finally {
          running -= 1;
        }
      });
      tail = result.then(
        () => undefined,
        () => undefined
      );
      return result;
    },
    // waiting makes busy() accurate synchronously at submission, before the
    // microtask that actually starts the first task has run.
    busy: () => running > 0 || waiting > 0,
    pending: () => waiting
  };
}
