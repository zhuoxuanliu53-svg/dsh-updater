/**
 * Host single-instance guard. If the same package were ever mounted twice
 * (e.g. a standalone install plus a family bundle), the second apply would
 * re-register the same webserver routes and settings namespace and fail the
 * boot; mountOnce makes the second host apply a no-op for the lifetime of
 * the first instance.
 *
 * The registry rides a global symbol so two module instances of the same
 * package still share one verdict. cordis `ctx.effect` runs its callback
 * immediately and treats the callback's return value as the fiber disposer,
 * so the unmarker is returned, not run.
 */
/**
 * Wrap a cordis plugin apply so the package runs at most once per process.
 * @param packageName - npm package identity shared by every install source.
 * @param fn - the original plugin apply.
 * @returns an apply of the same shape.
 */
export declare function mountOnce<T extends (...args: any[]) => unknown>(packageName: string, fn: T): T;
