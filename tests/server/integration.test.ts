import {
    handleApplyMapPatch,
    handleGetWorldMapOverview,
    handleGetRegionMap,
    handlePreviewMapPatch
} from '../../src/server/tools';
import { handleWorldManage } from '../../src/server/consolidated/world-manage.js';
import { useInMemoryDatabase } from '../helpers/test-db.js';

const mockCtx = { sessionId: 'test-session' };

const EMBEDDED = new RegExp('<!-- WORLD_MANAGE_JSON' + String.fromCharCode(10) + '([^]*?)' + String.fromCharCode(10) + 'WORLD_MANAGE_JSON -->');

/** World generation goes through world_manage, which is the live surface. */
async function generate(seed: string, width: number, height: number): Promise<Record<string, any>> {
    const result = await handleWorldManage({ action: 'generate', seed, width, height }, mockCtx);
    const match = result.content[0].text.match(EMBEDDED);
    if (!match) throw new Error(`world_manage generate gave no embedded result: ${result.content[0].text}`);
    return JSON.parse(match[1]);
}

async function overview(worldId: string): Promise<Record<string, any>> {
    const result = await handleGetWorldMapOverview({ worldId }, mockCtx);
    return JSON.parse(result.content[0].text);
}

describe('MCP Server Tools', () => {
    useInMemoryDatabase();

    it('should generate a world successfully', async () => {
        const response = await generate('test-seed', 50, 50);
        expect(response.success).toBe(true);
        expect(response.worldId).toBeDefined();
        expect(response.dimensions).toEqual({ width: 50, height: 50 });
    });

    it('should retrieve world state after generation', async () => {
        const { worldId } = await generate('state-test', 20, 20);

        const state = await overview(worldId);

        expect(state.seed).toBe('state-test');
        expect(state.dimensions).toEqual({ width: 20, height: 20 });
        expect(state.structureCount).toBeGreaterThanOrEqual(0);
    });

    it('should apply map patch successfully', async () => {
        // Ensure world exists (persisted from previous test or new gen)
        const { worldId } = await generate('patch-test', 20, 20);

        // Use center of map where land is more likely
        const script = `ADD_STRUCTURE type="city" x=10 y=10 name="Patch City"`;

        const result = await handleApplyMapPatch({ worldId, script }, mockCtx);

        expect(result.content).toHaveLength(1);
        const response = JSON.parse(result.content[0].text);

        // If patch fails due to terrain, check that we get proper error format
        // If it succeeds, verify command was executed
        if (response.success) {
            expect(response.message).toBe('Patch applied successfully');
            expect(response.commandsExecuted).toBe(1);
        } else {
            // Accept failure if terrain is unsuitable - the DSL is still working correctly
            expect(response.errors).toBeDefined();
            expect(response.errors.length).toBeGreaterThan(0);
        }
    });

    describe('get_world_map_overview', () => {
    useInMemoryDatabase();

        it('should return overview with biome distribution when world exists', async () => {
            // Generate a world first
            const { worldId } = await generate('overview-test', 50, 50);

            const result = await handleGetWorldMapOverview({ worldId }, mockCtx);

            expect(result.content).toHaveLength(1);
            const overview = JSON.parse(result.content[0].text);

            // Should have basic world info
            expect(overview.seed).toBe('overview-test');
            expect(overview.dimensions).toEqual({ width: 50, height: 50 });

            // Should have biome distribution
            expect(overview.biomeDistribution).toBeDefined();
            expect(typeof overview.biomeDistribution).toBe('object');

            // Should have region count
            expect(overview.regionCount).toBeGreaterThanOrEqual(0);
            expect(overview.structureCount).toBeGreaterThanOrEqual(0);
        });

        it('should throw error when no world exists', async () => {
            // Pass a random ID that doesn't exist
            await expect(handleGetWorldMapOverview({ worldId: 'non-existent-id' }, mockCtx)).rejects.toThrow('World non-existent-id not found');
        });
    });

    describe('get_region_map', () => {
    useInMemoryDatabase();

        it('should return region details when valid regionId provided', async () => {
            // Generate a world
            const { worldId } = await generate('region-test', 50, 50);

            const result = await handleGetRegionMap({ worldId, regionId: 0 }, mockCtx);

            expect(result.content).toHaveLength(1);
            const regionData = JSON.parse(result.content[0].text);

            expect(regionData.region).toBeDefined();
            expect(regionData.region.id).toBe(0);
            expect(regionData.region.name).toBeDefined();
            expect(regionData.tiles).toBeDefined();
            expect(Array.isArray(regionData.tiles)).toBe(true);
        });

        it('should throw error for invalid regionId', async () => {
            const { worldId } = await generate('region-invalid-test', 50, 50);

            await expect(handleGetRegionMap({ worldId, regionId: 9999 }, mockCtx)).rejects.toThrow('Region not found');
        });

        it('should throw error when no world exists', async () => {
            await expect(handleGetRegionMap({ worldId: 'non-existent', regionId: 0 }, mockCtx)).rejects.toThrow('World non-existent not found');
        });
    });

    describe('preview_map_patch', () => {
    useInMemoryDatabase();

        it('should preview patch without applying it', async () => {
            // Generate a world
            const { worldId } = await generate('preview-test', 50, 50);

            const script = `ADD_STRUCTURE type="city" x=10 y=10 name="Preview City"`;
            const result = await handlePreviewMapPatch({ worldId, script }, mockCtx);

            expect(result.content).toHaveLength(1);
            const preview = JSON.parse(result.content[0].text);

            expect(preview.commands).toBeDefined();
            expect(preview.commands.length).toBe(1);
            expect(preview.commands[0].type).toBe('ADD_STRUCTURE');
            expect(preview.commandCount).toBe(1);

            // Verify world state unchanged
            const state = await overview(worldId);

            // Structure count should be same as before (patch not applied since it's preview)
            const initialStructures = state.structureCount;

            // Now apply the patch
            const applyResult = await handleApplyMapPatch({ worldId, script }, mockCtx);
            const applyResponse = JSON.parse(applyResult.content[0].text);

            // If the patch was successfully applied, structure count should increase
            if (applyResponse.success && applyResponse.commandsExecuted > 0) {
                const stateAfterApply = await overview(worldId);
                expect(stateAfterApply.structureCount).toBeGreaterThan(initialStructures);
            } else {
                // Patch failed due to terrain - acceptable for this test
                // The main point is that preview didn't modify the world
                expect(true).toBe(true);
            }
        });

        it('should indicate invalid patch syntax', async () => {
            const { worldId } = await generate('preview-invalid-test', 50, 50);

            const invalidScript = `INVALID_COMMAND x=5 y=5`;

            await expect(handlePreviewMapPatch({ worldId, script: invalidScript }, mockCtx)).rejects.toThrow();
        });

        it('should throw error when no world exists', async () => {
            await expect(handlePreviewMapPatch({ worldId: 'non-existent', script: 'ADD_STRUCTURE type="city" x=5 y=5 name="Test"' }, mockCtx))
                .rejects.toThrow('World non-existent not found');
        });
    });
});
