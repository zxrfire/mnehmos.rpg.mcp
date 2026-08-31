import { handleLoadToolSchema } from '../../src/server/meta-tools';
import { buildConsolidatedRegistry } from '../../src/server/consolidated-registry';

describe('meta-tools schema surfaces', () => {
    it('should expose action-specific schemas for consolidated tools', async () => {
        const result = await handleLoadToolSchema({ toolName: 'combat_manage' });

        expect('error' in result).toBe(false);
        if ('error' in result) throw new Error(result.error);

        expect(result.inputSchema.action.type).toBe('string');
        expect(result.actionSchemas?.assess.required).toEqual(
            expect.arrayContaining(['action', 'opponent'])
        );
        expect(result.actionSchemas?.assess.required).not.toContain('edges');
        expect(result.actionSchemas?.strike.required).toEqual(
            expect.arrayContaining(['action', 'techniqueId', 'opponent'])
        );
        expect(result.actionSchemas?.history.required).toEqual(['action']);
        expect(result.inputSchema.action.description).toContain('assess');

        const items = await handleLoadToolSchema({ toolName: 'item_manage' });
        expect('error' in items).toBe(false);
        if ('error' in items) throw new Error(items.error);
        expect(items.actionSchemas?.create.required).toEqual(
            expect.arrayContaining(['action', 'name', 'type'])
        );
        expect(items.actionSchemas?.get.required).toEqual(['action', 'itemId']);
        expect(items.inputSchema.action.description).toContain('search');
    });

    it('should include aliases and descriptions in action schemas', async () => {
        const result = await handleLoadToolSchema({ toolName: 'combat_manage' });

        expect('error' in result).toBe(false);
        if ('error' in result) throw new Error(result.error);

        expect(result.actionSchemas?.resolve.aliases).toEqual(
            expect.arrayContaining(['fight', 'duel'])
        );
        expect(result.actionSchemas?.assess.description).toContain('gap');
    });

    it('should publish action-specific schema documentation for every consolidated tool', () => {
        const registry = buildConsolidatedRegistry();
        const missing = Object.entries(registry)
            .filter(([, entry]) => !entry.actionSchemas)
            .map(([name]) => name);

        expect(missing).toEqual([]);
    });

    it('should expose action requirements for manually routed tools', async () => {
        const batch = await handleLoadToolSchema({ toolName: 'batch_manage' });
        const travel = await handleLoadToolSchema({ toolName: 'travel_manage' });

        expect('error' in batch).toBe(false);
        expect('error' in travel).toBe(false);
        if ('error' in batch || 'error' in travel) {
            throw new Error('Expected schema responses');
        }

        expect(batch.actionSchemas?.execute_sequence.required).toEqual(
            expect.arrayContaining(['action', 'steps'])
        );
        expect(travel.actionSchemas?.travel.required).toEqual(
            expect.arrayContaining(['action', 'partyId', 'poiId'])
        );
    });
});
