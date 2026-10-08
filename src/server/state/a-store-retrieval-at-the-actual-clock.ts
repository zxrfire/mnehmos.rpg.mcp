/** Bind the shared actual-clock boundary, never an endpoint look. */
import type { WorldState } from '../../engine/world/world-state.js';
import type { RetrievalAuthority } from '../../engine/world/fetching-an-object-from-a-house-store.js';
import { continuePhysicalRetrievalsAtBoundary } from '../../engine/world/continuing-a-physical-store-retrieval.js';
import type Database from 'better-sqlite3';
import { CultivatorRepository } from '../../storage/repos/cultivator.repo.js';
import { SectRepository } from '../../storage/repos/sect.repo.js';
import { ledgerAbout, type ObligationDb } from '../../storage/repos/obligation.repo.js';
import { countedHoldings } from '../../web/breaking-a-thing-you-are-holding.js';
import { authorityForPhysicalRetrieval } from '../../web/reading-the-person-and-store-at-a-retrieval-boundary.js';

/**
 * The existing adapter supplies fresh repository/roll/pouch readers; core leaf
 * never imports SQL. A missing authoritative played read is `unavailable`.
 * projectPassengers is roads' canonical actual road/hull/craft boundary hook.
 * This composition deliberately cannot be called with an endpoint cultivator.
 */
export function retrievalAtTheActualClock(input: {
    projectPassengers: (world: WorldState, onDay: number) => void;
    authorityAt: (world: WorldState, onDay: number) => RetrievalAuthority;
    schedule?: (key: string, day: number) => void;
}): (world: WorldState, onDay: number) => void {
    return (world, onDay) => {
        input.projectPassengers(world, onDay);
        const authority = input.authorityAt(world, onDay);
        continuePhysicalRetrievalsAtBoundary(world, onDay, authority, input.schedule);
    };
}

/**
 * Exact repository binding for roads' shared chronological adapter. `playedId`
 * is the advancing person's identity, never a captured sheet. Null means no
 * played body is advancing: ordinary world recipients remain readable, stored
 * played recipients remain explicitly unavailable until their true read exists.
 */
export function retrievalBoundaryForDatabase(db: Database.Database, playedId: string | null,
    projectPassengers: (world: WorldState, onDay: number) => void,
    schedule?: (key: string, day: number) => void): (world: WorldState, onDay: number) => void {
    return retrievalAtTheActualClock({ projectPassengers, schedule,
        authorityAt: () => freshRetrievalAuthorityForDatabase(db, playedId) });
}

/** After roads' canonical projection; fresh identity-bound repository reads only. */
export function freshRetrievalAuthorityForDatabase(db: Database.Database, playedId: string | null): RetrievalAuthority {
    const cultivators = new CultivatorRepository(db);
    const sects = new SectRepository(db);
    return authorityForPhysicalRetrieval({
        rollRowFor: id => sects.getMembership(id),
        ledgerFor: id => ledgerAbout(db as unknown as ObligationDb, id),
        countedFor: id => countedHoldings(db, id),
        playedBodyAt: id => id === playedId ? cultivators.getById(id) ?? null : undefined
    });
}

/** No second projection: the server calls this only after projectActualPassengers. */
export function afterPassengersRetrievalBoundaryForDatabase(db: Database.Database,
    playedId: string | null): (world: WorldState, onDay: number) => void {
    return (world, onDay) => continuePhysicalRetrievalsAtBoundary(world, onDay,
        freshRetrievalAuthorityForDatabase(db, playedId));
}
