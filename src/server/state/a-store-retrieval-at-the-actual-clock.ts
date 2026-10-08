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
