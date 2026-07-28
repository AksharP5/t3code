import type { EnvironmentId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import { Atom, type AtomRegistry } from "effect/unstable/reactivity";

import { safeErrorLogAttributes } from "../errors/safeLog.ts";
import { EnvironmentCacheStore } from "../platform/persistence.ts";

export interface VcsRefsInvalidationTarget {
  readonly environmentId: EnvironmentId;
}

export interface CachedVcsRefsInvalidationTarget extends VcsRefsInvalidationTarget {
  readonly cwd: string;
}

const revisionByEnvironment = Atom.family((environmentId: EnvironmentId) =>
  Atom.make(0).pipe(Atom.withLabel(`environment-data:vcs:list-refs-revision:${environmentId}`)),
);

export function vcsRefsRevisionAtom(target: VcsRefsInvalidationTarget) {
  return revisionByEnvironment(target.environmentId);
}

export function invalidateVcsRefs(
  registry: AtomRegistry.AtomRegistry,
  target: VcsRefsInvalidationTarget,
): void {
  registry.update(vcsRefsRevisionAtom(target), (revision) => revision + 1);
}

/**
 * Removes the persisted snapshot before restarting live ref streams. This
 * prevents a remount during the refresh window from replaying pre-mutation
 * branch data.
 */
export const invalidateCachedVcsRefs = Effect.fn("VcsRefsState.invalidateCached")(function* (
  registry: AtomRegistry.AtomRegistry,
  target: CachedVcsRefsInvalidationTarget,
) {
  const cache = yield* EnvironmentCacheStore;
  yield* cache.removeVcsRefs(target.environmentId, target.cwd).pipe(
    Effect.catch((error) =>
      Effect.logWarning("Could not remove invalidated cached Git refs.").pipe(
        Effect.annotateLogs({
          environmentId: target.environmentId,
          cwd: target.cwd,
          ...safeErrorLogAttributes(error),
        }),
      ),
    ),
  );
  invalidateVcsRefs(registry, target);
});
