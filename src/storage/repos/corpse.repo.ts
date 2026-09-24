import Database from 'better-sqlite3';
import { v4 as uuid } from 'uuid';
import { Corpse, CorpseState, CORPSE_DECAY_RULES } from '../../schema/corpse.js';
import { InventoryRepository } from './inventory.repo.js';

/** Corpses and harvesting. */

interface CorpseRow {
    id: string;
    character_id: string;
    character_name: string;
    character_type: string;
    world_id: string | null;
    region_id: string | null;
    position_x: number | null;
    position_y: number | null;
    encounter_id: string | null;
    state: string;
    state_updated_at: string;
    loot_generated: number;
    looted: number;
    looted_by: string | null;
    looted_at: string | null;
    currency: string | null;
    currency_looted: number;
    harvestable: number;
    harvestable_resources: string;
    created_at: string;
    updated_at: string;
}

interface CorpseInventoryRow {
    corpse_id: string;
    item_id: string;
    quantity: number;
    looted: number;
}

export class CorpseRepository {
    private inventoryRepo: InventoryRepository;

    constructor(private db: Database.Database) {
        this.inventoryRepo = new InventoryRepository(db);
    }

    /** Create a corpse when a character dies */
    createFromDeath(characterId: string, characterName: string, characterType: 'pc' | 'npc' | 'enemy' | 'neutral', options: {
        encounterId?: string;
        position?: { x: number; y: number };
        worldId?: string;
        regionId?: string;
    } = {}): Corpse {
        const now = new Date().toISOString();
        const id = uuid();

        const stmt = this.db.prepare(`
            INSERT INTO corpses (
                id, character_id, character_name, character_type,
                world_id, region_id, position_x, position_y, encounter_id,
                state, state_updated_at, harvestable, harvestable_resources,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'fresh', ?, 0, '[]', ?, ?)
        `);

        stmt.run(
            id,
            characterId,
            characterName,
            characterType,
            options.worldId ?? null,
            options.regionId ?? null,
            options.position?.x ?? null,
            options.position?.y ?? null,
            options.encounterId ?? null,
            now,
            now,
            now
        );

        return this.findById(id)!;
    }

    findById(id: string): Corpse | null {
        const stmt = this.db.prepare(`SELECT * FROM corpses WHERE id = ?`);
        const row = stmt.get(id) as CorpseRow | undefined;
        if (!row) return null;
        return this.rowToCorpse(row);
    }

    findByCharacterId(characterId: string): Corpse | null {
        const stmt = this.db.prepare(`
            SELECT * FROM corpses
            WHERE character_id = ? AND state != 'gone'
            ORDER BY created_at DESC LIMIT 1
        `);
        const row = stmt.get(characterId) as CorpseRow | undefined;
        if (!row) return null;
        return this.rowToCorpse(row);
    }

    findByEncounterId(encounterId: string): Corpse[] {
        const stmt = this.db.prepare(`
            SELECT * FROM corpses
            WHERE encounter_id = ? AND state != 'gone'
        `);
        const rows = stmt.all(encounterId) as CorpseRow[];
        return rows.map(r => this.rowToCorpse(r));
    }

    findByRegion(worldId: string, regionId: string): Corpse[] {
        const stmt = this.db.prepare(`
            SELECT * FROM corpses
            WHERE world_id = ? AND region_id = ? AND state != 'gone'
        `);
        const rows = stmt.all(worldId, regionId) as CorpseRow[];
        return rows.map(r => this.rowToCorpse(r));
    }

    findNearPosition(worldId: string, x: number, y: number, radius: number = 3): Corpse[] {
        const stmt = this.db.prepare(`
            SELECT * FROM corpses
            WHERE world_id = ?
              AND state != 'gone'
              AND position_x IS NOT NULL
              AND position_y IS NOT NULL
              AND ABS(position_x - ?) <= ?
              AND ABS(position_y - ?) <= ?
        `);
        const rows = stmt.all(worldId, x, radius, y, radius) as CorpseRow[];
        return rows.map(r => this.rowToCorpse(r));
    }

    addToCorpseInventory(corpseId: string, itemId: string, quantity: number = 1): void {
        const stmt = this.db.prepare(`
            INSERT INTO corpse_inventory (corpse_id, item_id, quantity, looted)
            VALUES (?, ?, ?, 0)
            ON CONFLICT(corpse_id, item_id) DO UPDATE SET quantity = quantity + ?
        `);
        stmt.run(corpseId, itemId, quantity, quantity);
    }

    getCorpseInventory(corpseId: string): Array<{ itemId: string; quantity: number; looted: boolean }> {
        const stmt = this.db.prepare(`
            SELECT * FROM corpse_inventory
            WHERE corpse_id = ?
        `);
        const rows = stmt.all(corpseId) as CorpseInventoryRow[];
        return rows.map(r => ({
            itemId: r.item_id,
            quantity: r.quantity,
            looted: r.looted === 1
        }));
    }

    /** Get unlootable items from corpse */
    getAvailableLoot(corpseId: string): Array<{ itemId: string; quantity: number }> {
        const stmt = this.db.prepare(`
            SELECT * FROM corpse_inventory
            WHERE corpse_id = ? AND looted = 0
        `);
        const rows = stmt.all(corpseId) as CorpseInventoryRow[];
        return rows.map(r => ({
            itemId: r.item_id,
            quantity: r.quantity
        }));
    }

    /**
     * Loot an item from a corpse
     * @param transferToLooter - If true, adds item to looter's inventory
     */
    lootItem(corpseId: string, itemId: string, looterId: string, quantity?: number, transferToLooter?: boolean): {
        success: boolean;
        itemId: string;
        quantity: number;
        transferred: boolean;
        reason?: string;
    } {
        const corpse = this.findById(corpseId);
        if (!corpse) {
            return { success: false, itemId, quantity: 0, transferred: false, reason: 'Corpse not found' };
        }

        if (corpse.state === 'gone') {
            return { success: false, itemId, quantity: 0, transferred: false, reason: 'Corpse has decayed completely' };
        }

        const inventory = this.getAvailableLoot(corpseId);
        const item = inventory.find(i => i.itemId === itemId);
        if (!item) {
            return { success: false, itemId, quantity: 0, transferred: false, reason: 'Item not on corpse or already looted' };
        }

        const toLoot = quantity ?? item.quantity;
        if (toLoot > item.quantity) {
            return { success: false, itemId, quantity: 0, transferred: false, reason: `Only ${item.quantity} available` };
        }

        const now = new Date().toISOString();

        if (toLoot === item.quantity) {
            // Mark as fully looted
            const stmt = this.db.prepare(`
                UPDATE corpse_inventory SET looted = 1 WHERE corpse_id = ? AND item_id = ?
            `);
            stmt.run(corpseId, itemId);
        } else {
            // Reduce quantity
            const stmt = this.db.prepare(`
                UPDATE corpse_inventory SET quantity = quantity - ? WHERE corpse_id = ? AND item_id = ?
            `);
            stmt.run(toLoot, corpseId, itemId);
        }

        // Update corpse
        const updateStmt = this.db.prepare(`
            UPDATE corpses SET looted_by = ?, looted_at = ?, updated_at = ? WHERE id = ?
        `);
        updateStmt.run(looterId, now, now, corpseId);

        // Check if all items looted
        const remaining = this.getAvailableLoot(corpseId);
        if (remaining.length === 0) {
            const lootedStmt = this.db.prepare(`
                UPDATE corpses SET looted = 1, updated_at = ? WHERE id = ?
            `);
            lootedStmt.run(now, corpseId);
        }

        // Optionally transfer to looter's inventory
        let transferred = false;
        if (transferToLooter) {
            this.inventoryRepo.addItem(looterId, itemId, toLoot);
            transferred = true;
        }

        return { success: true, itemId, quantity: toLoot, transferred };
    }

    /**
     * Loot all items from a corpse
     * @param transferToLooter - If true, adds all items to looter's inventory
     */
    lootAll(corpseId: string, looterId: string, transferToLooter?: boolean): Array<{ itemId: string; quantity: number; transferred: boolean }> {
        const available = this.getAvailableLoot(corpseId);
        const looted: Array<{ itemId: string; quantity: number; transferred: boolean }> = [];

        for (const item of available) {
            const result = this.lootItem(corpseId, item.itemId, looterId, item.quantity, transferToLooter);
            if (result.success) {
                looted.push({ itemId: result.itemId, quantity: result.quantity, transferred: result.transferred });
            }
        }

        return looted;
    }

    /**
     * Loot currency from a corpse
     * @param transferToLooter - If true, adds currency to looter's inventory
     */
    lootCurrency(corpseId: string, looterId: string, transferToLooter?: boolean): {
        success: boolean;
        currency: { gold: number; silver: number; copper: number };
        transferred: boolean;
        reason?: string;
    } {
        const corpse = this.findById(corpseId);
        if (!corpse) {
            return { success: false, currency: { gold: 0, silver: 0, copper: 0 }, transferred: false, reason: 'Corpse not found' };
        }

        if (corpse.currencyLooted) {
            return { success: false, currency: { gold: 0, silver: 0, copper: 0 }, transferred: false, reason: 'Currency already looted' };
        }

        const currency = corpse.currency;
        if (currency.gold === 0 && currency.silver === 0 && currency.copper === 0) {
            return { success: false, currency: { gold: 0, silver: 0, copper: 0 }, transferred: false, reason: 'No currency on corpse' };
        }

        // Mark currency as looted
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
            UPDATE corpses SET currency_looted = 1, updated_at = ? WHERE id = ?
        `);
        stmt.run(now, corpseId);

        // Optionally transfer to looter's inventory
        let transferred = false;
        if (transferToLooter) {
            this.inventoryRepo.addCurrency(looterId, currency);
            transferred = true;
        }

        return { success: true, currency, transferred };
    }

    /**
     * Harvest a resource from a corpse
     * @param createItem - If true, creates an item in the items table and adds to harvester inventory
     */
    harvestResource(corpseId: string, resourceType: string, harvesterId: string, options?: {
        skillCheck?: { roll: number; dc: number };
        createItem?: boolean;
    }): {
        success: boolean;
        quantity: number;
        resourceType: string;
        itemId?: string;
        transferred: boolean;
        reason?: string;
    } {
        const corpse = this.findById(corpseId);
        if (!corpse) {
            return { success: false, quantity: 0, resourceType, transferred: false, reason: 'Corpse not found' };
        }

        if (!corpse.harvestable) {
            return { success: false, quantity: 0, resourceType, transferred: false, reason: 'Corpse has no harvestable resources' };
        }

        if (corpse.state === 'skeletal' || corpse.state === 'gone') {
            return { success: false, quantity: 0, resourceType, transferred: false, reason: 'Corpse too decayed to harvest' };
        }

        const resources = corpse.harvestableResources;
        const resource = resources.find(r => r.resourceType === resourceType && !r.harvested);
        if (!resource) {
            return { success: false, quantity: 0, resourceType, transferred: false, reason: 'Resource not available or already harvested' };
        }

        // Check DC if required
        if (options?.skillCheck) {
            if (options.skillCheck.roll < options.skillCheck.dc) {
                return { success: false, quantity: 0, resourceType, transferred: false, reason: `Failed skill check (${options.skillCheck.roll} vs DC ${options.skillCheck.dc})` };
            }
        }

        // Mark as harvested
        resource.harvested = true;
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
            UPDATE corpses
            SET harvestable_resources = ?, updated_at = ?
            WHERE id = ?
        `);
        stmt.run(JSON.stringify(resources), now, corpseId);

        // Optionally create item and add to harvester inventory
        let itemId: string | undefined;
        let transferred = false;
        if (options?.createItem) {
            // Create the item in items table
            itemId = uuid();
            const createStmt = this.db.prepare(`
                INSERT INTO items (id, name, description, type, weight, value, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            createStmt.run(
                itemId,
                resourceType, // Use resource type as item name (e.g., "wolf pelt")
                `Harvested ${resourceType} from a corpse`,
                'misc',
                1,
                10, // Default value, could be parameterized
                now,
                now
            );

            // Add to harvester inventory
            this.inventoryRepo.addItem(harvesterId, itemId, resource.quantity);
            transferred = true;
        }

        return { success: true, quantity: resource.quantity, resourceType, itemId, transferred };
    }

    /** Process corpse decay based on time passed */
    processDecay(hoursAdvanced: number): { corpseId: string; oldState: CorpseState; newState: CorpseState }[] {
        const changes: { corpseId: string; oldState: CorpseState; newState: CorpseState }[] = [];
        const stmt = this.db.prepare(`SELECT * FROM corpses WHERE state != 'gone'`);
        const corpses = stmt.all() as CorpseRow[];

        const now = new Date();

        for (const row of corpses) {
            const stateUpdated = new Date(row.state_updated_at);
            const hoursSinceUpdate = Math.floor((now.getTime() - stateUpdated.getTime()) / (1000 * 60 * 60)) + hoursAdvanced;

            let currentState = row.state as CorpseState;
            let newState = currentState;

            if (currentState === 'fresh' && hoursSinceUpdate >= CORPSE_DECAY_RULES.fresh_to_decaying) {
                newState = 'decaying';
            } else if (currentState === 'decaying' && hoursSinceUpdate >= CORPSE_DECAY_RULES.decaying_to_skeletal) {
                newState = 'skeletal';
            } else if (currentState === 'skeletal' && hoursSinceUpdate >= CORPSE_DECAY_RULES.skeletal_to_gone) {
                newState = 'gone';
            }

            if (newState !== currentState) {
                this.updateState(row.id, newState);
                changes.push({ corpseId: row.id, oldState: currentState, newState });
            }
        }

        return changes;
    }

    updateState(corpseId: string, newState: CorpseState): void {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
            UPDATE corpses SET state = ?, state_updated_at = ?, updated_at = ? WHERE id = ?
        `);
        stmt.run(newState, now, now, corpseId);
    }

    cleanupGoneCorpses(): number {
        // Delete corpse inventory first
        const deleteInventory = this.db.prepare(`
            DELETE FROM corpse_inventory WHERE corpse_id IN (SELECT id FROM corpses WHERE state = 'gone')
        `);
        deleteInventory.run();

        // Delete corpses
        const deleteCorpses = this.db.prepare(`DELETE FROM corpses WHERE state = 'gone'`);
        const result = deleteCorpses.run();
        return result.changes;
    }

    private rowToCorpse(row: CorpseRow): Corpse {
        let currency = { gold: 0, silver: 0, copper: 0 };
        if (row.currency) {
            try {
                const parsed = JSON.parse(row.currency);
                currency = {
                    gold: parsed.gold ?? 0,
                    silver: parsed.silver ?? 0,
                    copper: parsed.copper ?? 0
                };
            } catch {
                // Keep default
            }
        }

        return {
            id: row.id,
            characterId: row.character_id,
            characterName: row.character_name,
            characterType: row.character_type as 'pc' | 'npc' | 'enemy' | 'neutral',
            worldId: row.world_id,
            regionId: row.region_id,
            position: row.position_x !== null && row.position_y !== null
                ? { x: row.position_x, y: row.position_y }
                : null,
            encounterId: row.encounter_id,
            state: row.state as CorpseState,
            stateUpdatedAt: row.state_updated_at,
            lootGenerated: row.loot_generated === 1,
            looted: row.looted === 1,
            lootedBy: row.looted_by,
            lootedAt: row.looted_at,
            currency,
            currencyLooted: row.currency_looted === 1,
            harvestable: row.harvestable === 1,
            harvestableResources: JSON.parse(row.harvestable_resources),
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }
}
