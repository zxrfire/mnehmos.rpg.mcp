import { ConsolidatedTools } from '../../src/server/consolidated/index.js';
import { buildConsolidatedRegistry } from '../../src/server/consolidated-registry.js';

describe('consolidated tool contracts', () => {
    it('keeps metadata, schemas, action docs, and handlers in one contract per tool', () => {
        // 22, down from 37. The spellcasting, character-sheet and three combat
        // tools went with the engines behind them and one cultivation-facing
        // combat_manage replaced the three; a second pass then removed six that
        // were registered here and imported nowhere else - quest, party,
        // strategy, theft, corpse and improvisation. turn_manage went with the
        // D&D-era strategy module.
        expect(ConsolidatedTools).toHaveLength(22);
        expect(new Set(ConsolidatedTools.map(contract => contract.name)).size).toBe(22);

        for (const contract of ConsolidatedTools) {
            expect(contract.metadata.name).toBe(contract.name);
            expect(contract.metadata.description).toBe(contract.description);
            expect(contract.schema).toBe(contract.inputSchema);
            expect(contract.actionSchemas).toBeDefined();
            expect(typeof contract.handler).toBe('function');
        }
    });

    it('builds the runtime registry as a projection of those contracts', () => {
        const registry = buildConsolidatedRegistry();

        for (const contract of ConsolidatedTools) {
            const entry = registry[contract.name];
            expect(entry).toBeDefined();
            expect(entry.metadata).toBe(contract.metadata);
            expect(entry.schema).toBe(contract.schema);
            expect(entry.actionSchemas).toBe(contract.actionSchemas);
            expect(entry.handler).toBe(contract.handler);
        }
    });
});
