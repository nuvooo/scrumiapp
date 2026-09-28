let chain: Promise<unknown> = Promise.resolve();

/**
 * Führt Syncs nacheinander aus: Intervall-Sync, Daily-Snapshot und manueller
 * Sync ersetzen Issues per delete+create und dürfen sich nicht überlappen.
 */
export function withSyncLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
}
