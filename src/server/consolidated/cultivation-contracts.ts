/**
 * Tool contracts for the cultivation surface.
 *
 * Mirrors `contracts.ts` exactly - one authoritative descriptor table, one
 * `defineToolContract`-shaped factory - but lives in its own file so the
 * cultivation tools can be registered without editing the D&D-era descriptor
 * table that another agent owns. The two tables are merged only at the point of
 * registration in `index.ts`.
 */

import { ToolContract, ToolCategory, ToolMetadata } from '../tool-metadata.js';

interface ToolDescriptor {
    category: ToolCategory;
    keywords: string[];
    capabilities: string[];
    contextAware?: boolean;
    estimatedTokenCost?: ToolMetadata['estimatedTokenCost'];
    deferLoading?: boolean;
}

const CULTIVATION_TOOL_DESCRIPTORS: Readonly<Record<string, ToolDescriptor>> = {
    cultivation_manage: {
        category: 'cultivation',
        keywords: [
            'cultivate', 'cultivation', 'xianxia', 'realm', 'breakthrough', 'qi', 'seclusion',
            'spirit root', 'talent', 'time skip', 'meditate', 'ladder', 'rank', 'tribulation',
            'deviation', 'progress', 'injury', 'meridian'
        ],
        capabilities: [
            'Server-side spirit-root and attribute rolls from the run seed',
            'Whole-duration time skips ("ten years") resolved in one deterministic pass',
            'Breakthrough attempts with the full itemised modifier breakdown and raw roll',
            'Permadeath persistence: death closes the run in the same transaction',
            'The 45-rank realm ladder as a reference table'
        ],
        estimatedTokenCost: 'variable'
    },
    run_manage: {
        category: 'run',
        keywords: [
            'run', 'permadeath', 'seed', 'ledger', 'death', 'ledger', 'reproducibility',
            'start', 'end', 'clock', 'turn'
        ],
        capabilities: [
            'Run lifecycle with no path back from a closed run',
            'Death ledger, admin-flagged runs excluded',
            'Seed and named sub-stream disclosure for reproducibility'
        ],
        estimatedTokenCost: 'low'
    },
    technique_manage: {
        category: 'technique',
        keywords: [
            'technique', 'art', 'manual', 'learn', 'practise', 'practice', 'mastery',
            'element', 'wuxing', 'deviation', 'forbidden', 'qinggong'
        ],
        capabilities: [
            'Availability gated by realm ordinal and spirit-root compatibility',
            'Conflicting-element learning routed through the qi-deviation engine',
            'Mastery accrual over in-world time',
            'Seeded effect rolls'
        ],
        estimatedTokenCost: 'medium'
    },
    alchemy_manage: {
        category: 'alchemy',
        keywords: [
            'alchemy', 'pill', 'refine', 'recipe', 'herb', 'cauldron', 'toxicity',
            'grain abstinence', 'heal', 'treat injury', 'inventory', 'pouch'
        ],
        capabilities: [
            'Engine-resolved refinement odds from base rate, realm margin, Insight and supplements',
            'Catalog-driven pill effects applied through the engine',
            'Pill toxicity accumulating into real poison injuries',
            'Pouch inventory of pills and herbs'
        ],
        estimatedTokenCost: 'medium'
    },
    sect_manage: {
        category: 'sect',
        keywords: [
            'sect', 'join', 'disciple', 'elder', 'promote', 'stipend', 'contribution',
            'standing', 'righteous', 'demonic', 'membership'
        ],
        capabilities: [
            'Admission ordinal enforcement',
            'Promotion requiring both realm ordinal and spent contribution',
            'Stipend accrued from the in-world clock'
        ],
        estimatedTokenCost: 'low'
    },
    combat_manage: {
        category: 'combat',
        keywords: [
            'combat', 'fight', 'duel', 'confront', 'attack', 'strike', 'kill', 'flee', 'escape',
            'ambush', 'formation', 'poison', 'realm gap', 'upset', 'initiative', 'encounter',
            'grudge', 'feud', 'capture', 'humiliate'
        ],
        capabilities: [
            'Refuses a direct confrontation across two major realms and returns the options that work',
            'Composite power priced as itemised, multiplicative factors that reproduce the total',
            'Upsets gated behind earned edges, capped below a two-realm gap',
            'Tradition-aware killing: soul arts do nothing to the Cut, a destroyed body does not end the Drawn',
            'Outcomes beyond death - withdrawal, capture, humiliation, crippling, a standing feud',
            'Multi-party encounters with a rank-dominated order of action'
        ],
        estimatedTokenCost: 'variable'
    },
    admin_manage: {
        category: 'admin',
        keywords: [
            'admin', 'debug', 'testing', 'spawn', 'grant', 'roster', 'gate', 'audit',
            'set realm', 'advance days', 'ambient'
        ],
        capabilities: [
            'ADMIN_MODE-gated content-gate lifts that perform real persisted mutations',
            'Read-only world roster',
            'Engine-rolled site and encounter instantiation',
            'Full audit trail; admin runs excluded from the death ledger'
        ],
        estimatedTokenCost: 'medium'
    }
};

type ToolShape = {
    name: string;
    description: string;
    inputSchema: any;
    actionSchemas?: any;
};

/** Same construction as `defineToolContract`, over the cultivation table. */
export function defineCultivationToolContract(tool: ToolShape, handler: Function): ToolContract {
    const descriptor = CULTIVATION_TOOL_DESCRIPTORS[tool.name];
    if (!descriptor) {
        throw new Error(`Missing cultivation tool descriptor for ${tool.name}`);
    }

    const metadata: ToolMetadata = {
        name: tool.name,
        description: tool.description,
        category: descriptor.category,
        keywords: descriptor.keywords,
        capabilities: descriptor.capabilities,
        contextAware: descriptor.contextAware ?? false,
        estimatedTokenCost: descriptor.estimatedTokenCost ?? 'medium',
        usageExample: `${tool.name}({ action: '...' })`,
        deferLoading: descriptor.deferLoading ?? true,
    };

    return {
        ...tool,
        metadata,
        schema: tool.inputSchema,
        actionSchemas: tool.actionSchemas,
        handler,
    };
}

export function getCultivationToolDescriptors(): Readonly<Record<string, ToolDescriptor>> {
    return CULTIVATION_TOOL_DESCRIPTORS;
}
