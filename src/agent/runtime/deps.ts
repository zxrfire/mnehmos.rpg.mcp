/**
 * Agent runtime dependency registrar.
 *
 * Runtime repositories belong to the request's database. Agent and combat tools
 * reuse the runtime registered for that handle, never another campaign's.
 */

import Database from 'better-sqlite3';
import { ProviderFactory } from '../provider/factory.js';
import { AgentRepository } from '../../storage/repos/agent.repo.js';
import { CharacterRepository } from '../../storage/repos/character.repo.js';
import { ConcentrationRepository } from '../../storage/repos/concentration.repo.js';
import { InventoryRepository } from '../../storage/repos/inventory.repo.js';
import { NpcMemoryRepository } from '../../storage/repos/npc-memory.repo.js';
import { EventInboxRepository } from '../../storage/repos/event-inbox.repo.js';
import { EncounterRepository } from '../../storage/repos/encounter.repo.js';
import { SceneRepository } from '../../storage/repos/scene.repo.js';

export interface AgentRuntimeDeps {
    db: Database.Database;
    providerFactory: ProviderFactory;
    agentRepo: AgentRepository;
    characterRepo: CharacterRepository;
    concentrationRepo: ConcentrationRepository;
    inventoryRepo: InventoryRepository;
    npcMemoryRepo: NpcMemoryRepository;
    eventInboxRepo: EventInboxRepository;
    encounterRepo: EncounterRepository;
    sceneRepo: SceneRepository;
}

let runtimes = new WeakMap<Database.Database, AgentRuntimeDeps>();

/** Null clears the registrations. */
export function setAgentRuntime(deps: AgentRuntimeDeps | null): void {
    if (deps === null) runtimes = new WeakMap();
    else runtimes.set(deps.db, deps);
}

export function getAgentRuntime(db: Database.Database): AgentRuntimeDeps | null {
    return runtimes.get(db) ?? null;
}

/**
 * Convenience: build runtime deps from a db handle + provider factory.
 * Used by both production wiring and tests.
 */
export function buildAgentRuntime(db: Database.Database, providerFactory: ProviderFactory): AgentRuntimeDeps {
    const deps: AgentRuntimeDeps = {
        db,
        providerFactory,
        agentRepo: new AgentRepository(db),
        characterRepo: new CharacterRepository(db),
        concentrationRepo: new ConcentrationRepository(db),
        inventoryRepo: new InventoryRepository(db),
        npcMemoryRepo: new NpcMemoryRepository(db),
        eventInboxRepo: new EventInboxRepository(db),
        encounterRepo: new EncounterRepository(db),
        sceneRepo: new SceneRepository(db)
    };
    setAgentRuntime(deps);
    return deps;
}
