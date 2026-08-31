/**
 * Consolidated Tool Registry for v1.0 Clean-Break Release.
 *
 * The registry is deliberately a projection of the ToolContract objects in
 * consolidated/index.ts.  It does not maintain a second metadata map.
 */

import { ToolMetadata, ToolCategory, ToolRegistry } from './tool-metadata.js';
import { ConsolidatedTools } from './consolidated/index.js';

let cachedRegistry: ToolRegistry | null = null;

export function buildConsolidatedRegistry(): ToolRegistry {
    if (cachedRegistry) return cachedRegistry;

    cachedRegistry = {};
    for (const contract of ConsolidatedTools) {
        cachedRegistry[contract.name] = {
            metadata: contract.metadata,
            schema: contract.schema,
            actionSchemas: contract.actionSchemas,
            handler: contract.handler,
        };
    }

    return cachedRegistry;
}

export function getAllConsolidatedToolMetadata(): ToolMetadata[] {
    return Object.values(buildConsolidatedRegistry()).map(entry => entry.metadata);
}

export function getConsolidatedToolCategories(): ToolCategory[] {
    return [
        'world', 'inventory', 'party',
        'math', 'secret',
        'npc', 'spatial',
        'turn-management', 'meta', 'narrative', 'agent',
        'cultivation', 'run', 'technique', 'alchemy', 'sect', 'admin', 'combat'
    ];
}

export function getConsolidatedToolByName(name: string) {
    return buildConsolidatedRegistry()[name] || null;
}
