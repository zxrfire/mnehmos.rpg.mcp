import type {
    CatalogFaction,
    CatalogRegion,
    WorldCatalog
} from '../../../src/engine/world/catalog.js';

/**
 * A small world with the shapes that matter.
 *
 * Deliberately a fixture rather than the live catalogs. The soak test is
 * measuring the simulation, and if it read `src/data/cultivation/` it would
 * instead be measuring whatever the content author changed this morning - which
 * makes a five-century determinism assertion fail for reasons that have nothing
 * to do with the engine.
 *
 * What it does preserve is every shape the seeder branches on: all four
 * governance models, a faction that holds no vein, one that takes no
 * applicants, symmetric rivalries, a rich region and a poor one, and a region
 * whose local ceiling is low enough that nobody born there gets out on talent
 * alone.
 */

function faction(init: Partial<CatalogFaction> & Pick<CatalogFaction, 'id' | 'name'>): CatalogFaction {
    return {
        alignment: 'neutral',
        ranks: ['Outer Disciple', 'Inner Disciple', 'Core Disciple', 'Elder', 'Grand Elder', 'Patriarch'],
        powerOrdinal: 19,
        admissionOrdinal: 3,
        recruits: true,
        territory: '',
        rivalIds: [],
        governance: 'unbacked',
        parentFactionId: null,
        holdsVein: false,
        tributeStonesPerYear: 0,
        renewalYears: 0,
        production: 0.5,
        formationIntegrity: 0.4,
        description: '',
        ...init
    };
}

function region(init: Partial<CatalogRegion> & Pick<CatalogRegion, 'id' | 'name'>): CatalogRegion {
    return {
        home: false,
        summary: 'A province.',
        ambient: 'normal',
        qiDensity: 0.4,
        localCeilingOrdinal: 20,
        hazards: [],
        ambientRateMultiplier: 1,
        politics: 'competing_sects',
        factionIds: [],
        places: [],
        connections: [],
        exports: [],
        scars: [],
        specialRules: [],
        veinStatus: 'A vein under the gorge, worked for four hundred years.',
        ...init
    };
}

export function fixtureCatalog(): WorldCatalog {
    return {
        factions: [
            faction({
                id: 'sect-azure-cloud',
                name: 'Azure Cloud Pavilion',
                alignment: 'righteous',
                powerOrdinal: 21,
                admissionOrdinal: 4,
                governance: 'federated',
                parentFactionId: 'court-third-sill',
                holdsVein: true,
                tributeStonesPerYear: 40_000,
                renewalYears: 12,
                production: 0.6,
                rivalIds: ['sect-crimson-abyss'],
                territory: 'region-low-fall'
            }),
            faction({
                id: 'sect-crimson-abyss',
                name: 'Crimson Abyss Hall',
                alignment: 'demonic',
                powerOrdinal: 20,
                admissionOrdinal: 6,
                governance: 'unbacked',
                holdsVein: false,
                production: 0.3,
                rivalIds: ['sect-azure-cloud'],
                territory: 'region-low-fall'
            }),
            faction({
                id: 'sect-standing-grove',
                name: 'Standing Grove',
                powerOrdinal: 25,
                admissionOrdinal: 8,
                governance: 'deference',
                holdsVein: true,
                production: 0.8,
                recruits: false,
                territory: 'region-low-fall'
            }),
            faction({
                id: 'sect-weir-office',
                name: 'Weir Office',
                kind: undefined as never,
                powerOrdinal: 17,
                admissionOrdinal: 2,
                governance: 'administered',
                holdsVein: true,
                production: 0.7,
                territory: 'region-scarwater'
            }),
            faction({
                id: 'sect-gleaners-company',
                name: "Gleaners' Company",
                powerOrdinal: 14,
                admissionOrdinal: 0,
                governance: 'unbacked',
                holdsVein: false,
                production: 0.2,
                territory: 'region-scarwater'
            }),
            faction({
                id: 'court-third-sill',
                name: 'Third Sill Court',
                powerOrdinal: 33,
                admissionOrdinal: 21,
                governance: 'administered',
                holdsVein: true,
                production: 0.95,
                recruits: false,
                territory: 'region-highstair'
            })
        ],
        regions: [
            region({
                id: 'region-low-fall',
                name: 'The Low Fall',
                home: true,
                qiDensity: 0.45,
                ambient: 'normal',
                localCeilingOrdinal: 21,
                ambientRateMultiplier: 1,
                hazards: ['thin_qi'],
                factionIds: ['sect-azure-cloud', 'sect-crimson-abyss', 'sect-standing-grove'],
                exports: ['herbs', 'ore'],
                places: [
                    { name: 'Sweptground', kind: 'market_town', ambient: 'normal', note: 'The market.' },
                    { name: 'Coldfall', kind: 'village', ambient: 'thin', note: 'Upriver.' },
                    { name: 'The Old Compound', kind: 'site', ambient: 'dense', note: 'Nobody built it.' }
                ],
                connections: [{ otherRegionId: 'region-scarwater', kind: 'trade_route', travelDays: 9 }],
                scars: ['The gorge vein has been worked since before the records.']
            }),
            region({
                id: 'region-scarwater',
                name: 'Scarwater',
                qiDensity: 0.18,
                ambient: 'thin',
                // Low enough that talent alone does not get anybody out.
                localCeilingOrdinal: 13,
                ambientRateMultiplier: 0.6,
                hazards: ['thin_qi', 'corrosive'],
                politics: 'no_authority',
                factionIds: ['sect-weir-office', 'sect-gleaners-company'],
                exports: ['salt'],
                places: [
                    { name: 'Scarwater', kind: 'village', ambient: 'thin', note: 'On the dead ground.' },
                    { name: 'The Weir', kind: 'waystation', ambient: 'thin', note: 'A toll.' }
                ],
                connections: [{ otherRegionId: 'region-low-fall', kind: 'trade_route', travelDays: 9 }],
                specialRules: ['soul cultivation: the ground will not hold it'],
                scars: ['A war killed the vein here and it has not come back.']
            }),
            region({
                id: 'region-highstair',
                name: 'Highstair',
                qiDensity: 0.72,
                ambient: 'dense',
                localCeilingOrdinal: 33,
                ambientRateMultiplier: 1.4,
                politics: 'single_hegemon',
                factionIds: ['court-third-sill'],
                exports: ['pills', 'formations'],
                places: [
                    { name: 'The Third Sill Court', kind: 'city', ambient: 'dense', note: 'It administers.' }
                ],
                connections: [{ otherRegionId: 'region-low-fall', kind: 'shared_institution', travelDays: 21 }],
                scars: ['The deepest vein in the province, and it is spoken for.']
            })
        ],
        techniqueIds: ['tech-borrowed-breath', 'tech-lid-watching-stance', 'tech-nine-severing-threads']
    };
}
