/**
 * Validation for the non-human population.
 *
 * The assertions that matter are the ones that stop beasts becoming a
 * bestiary bolted onto the setting:
 *
 *   - one ladder, so danger is a realm ordinal and nothing else
 *   - the change at Core Formation is a hard floor under anything that speaks
 *   - they live where the qi is, so the good ground is contested before any
 *     sect arrives
 *   - the Late Age applies to them: thin ground has thin populations and the
 *     impressive things are behind seals
 *   - a tide has a cause, never a spawn table
 *   - a contract is mutual and expensive, and is never phrased as acquisition
 *   - no stat blocks anywhere, in this repo's specific sense
 */

import { describe, it, expect } from 'vitest';

import { MAX_ORDINAL, rankName } from '../../src/engine/cultivation/realms.js';
import { HERB_VALUE_BANDS, HERB_RARITY_CEILING, HerbBiomeSchema } from '../../src/data/cultivation/herbs.js';
import { getEncounter, ENCOUNTERS, ruinWeightShare } from '../../src/data/cultivation/encounters.js';
import { REGIONS } from '../../src/data/cultivation/regions.js';
import { getCultivationCatalogCounts } from '../../src/data/cultivation/index.js';
import {
    BEASTS,
    BEAST_MATERIALS,
    BEAST_TIDES,
    BEAST_CHANGE_ORDINAL,
    THE_BEAST_ROAD,
    ESTIMATING_A_BEAST,
    THE_CONTRACT,
    CONTRACT_ENGINE_REQUIREMENTS,
    BeastSchema,
    BeastMaterialSchema,
    BeastTideSchema,
    getBeast,
    requireBeast,
    getBeastsByNature,
    getBeastsByBiome,
    getBeastMaterial,
    materialsOf,
    coreOf,
    getBeastTide,
    tidesInRegion,
    beastsInTide,
    describeBeastRealm,
    findBeastsForOrdinal,
    findThreatsAboveOrdinal,
    veinContenders,
    sealedOnlyBeasts,
    negotiableBeasts,
    rollBeast
} from '../../src/data/cultivation/beasts.js';

const BEAST_IDS = new Set(BEASTS.map(b => b.id));

describe('spirit beasts: the catalog', () => {
    it('parses, and there is enough of it to populate a province', () => {
        expect(BEASTS.length).toBeGreaterThanOrEqual(12);
        for (const b of BEASTS) {
            expect(() => BeastSchema.parse(b), b.id).not.toThrow();
        }
        expect(getBeast('beast-ironhide-boar')).toBeDefined();
        expect(getBeast('beast-nothing')).toBeUndefined();
        expect(() => requireBeast('beast-nothing')).toThrow();
    });

    it('has unique ids and unique names', () => {
        expect(new Set(BEASTS.map(b => b.id)).size).toBe(BEASTS.length);
        expect(new Set(BEASTS.map(b => b.name)).size).toBe(BEASTS.length);
    });

    it('uses the herb catalog\'s biome vocabulary, so ground resolves once', () => {
        for (const b of BEASTS) {
            expect(() => HerbBiomeSchema.parse(b.biome), b.id).not.toThrow();
            expect(getBeastsByBiome(b.biome).map(x => x.id)).toContain(b.id);
        }
        expect(getBeastsByBiome('sky_island')).toEqual([]);
    });

    it('covers the range: ordinary animals through to something ancient', () => {
        const natures = new Set(BEASTS.map(b => b.nature));
        for (const required of ['ordinary', 'herd', 'ambush', 'territorial', 'intelligent', 'ancient'] as const) {
            expect(natures.has(required), `nothing in the catalog is ${required}`).toBe(true);
            expect(getBeastsByNature(required).length).toBeGreaterThan(0);
        }
        // Ordinary things low, ancient things high, with the ladder in between.
        expect(Math.min(...BEASTS.map(b => b.ordinal))).toBeLessThanOrEqual(2);
        expect(Math.max(...BEASTS.map(b => b.ordinal))).toBeGreaterThanOrEqual(29);
        for (const b of BEASTS) {
            expect(b.ordinal).toBeGreaterThanOrEqual(0);
            expect(b.ordinal).toBeLessThanOrEqual(MAX_ORDINAL);
        }
    });
});

describe('one ladder: danger is an ordinal, not a stat block', () => {
    it('reads a beast with the same realm vocabulary as a cultivator', () => {
        for (const b of BEASTS) {
            expect(describeBeastRealm(b)).toBe(rankName(b.ordinal));
        }
        // And the vocabulary is the human one, unchanged.
        expect(describeBeastRealm(requireBeast('beast-earth-dragon'))).toMatch(/Deity Transformation/);
    });

    it('carries no combat statistics in the discarded idiom', () => {
        const banned = [
            /\bhit points?\b/i, /\bhp\b/i, /\barmou?r class\b/i, /\bAC\b/,
            /\bd(4|6|8|10|12|20)\b/i, /\bchallenge rating\b/i, /\bCR \d/,
            /\bsaving throw\b/i, /\bstrength score\b/i, /\battack bonus\b/i,
            /\bdamage dice\b/i, /\bstat block\b/i
        ];
        const corpus = [
            ...BEASTS.map(b => ({ label: b.id, text: `${b.name} ${b.hard} ${b.note}` })),
            ...BEAST_MATERIALS.map(m => ({ label: m.id, text: `${m.name} ${m.description}` })),
            ...BEAST_TIDES.map(t => ({ label: t.id, text: `${t.name} ${t.cause} ${t.aftermath}` }))
        ];
        for (const { label, text } of corpus) {
            for (const pattern of banned) {
                expect(pattern.test(text), `${label} carries a stat block: ${pattern}`).toBe(false);
            }
        }
    });

    it('states what makes each one hard without restating that it is strong', () => {
        for (const b of BEASTS) {
            expect(b.hard.length, `${b.id} has no specific difficulty`).toBeGreaterThan(40);
            expect(b.note.length, `${b.id} needs a line of flavour`).toBeGreaterThan(40);
            // Small and reusable: an entry that needs a paragraph is not one.
            expect(b.note.length, `${b.id} is a paragraph`).toBeLessThan(320);
            expect(b.hard.length, `${b.id} is a paragraph`).toBeLessThan(360);
        }
    });

    it('is inert, like every catalog beside it', () => {
        // Nothing here decides anything; the draw takes the caller's sample.
        const first = rollBeast(44, 0);
        const same = rollBeast(44, 0);
        expect(first?.id).toBe(same?.id);
        expect(rollBeast(44, 0.999999999)).toBeDefined();
        expect(rollBeast(0, 0.5)?.ordinal).toBeLessThanOrEqual(0);
    });
});

describe('the change, and why a talking beast is never the easy option', () => {
    it('puts a Core Formation floor under anything that speaks', () => {
        expect(BEAST_CHANGE_ORDINAL).toBe(17);
        expect(rankName(BEAST_CHANGE_ORDINAL)).toMatch(/Core Formation/);
        for (const b of BEASTS) {
            if (b.speaks) {
                expect(b.ordinal, `${b.id} speaks below the change`).toBeGreaterThanOrEqual(BEAST_CHANGE_ORDINAL);
            }
        }
        expect(negotiableBeasts().length, 'nothing can be negotiated with').toBeGreaterThanOrEqual(1);
    });

    it('has things above the change that do not speak, which is worse', () => {
        const silentAndHigh = BEASTS.filter(b => b.ordinal >= BEAST_CHANGE_ORDINAL && !b.speaks);
        expect(silentAndHigh.length).toBeGreaterThanOrEqual(2);
    });

    it('marks the intelligent ones as parties rather than problems', () => {
        for (const b of getBeastsByNature('intelligent')) {
            expect(b.speaks, `${b.id} is intelligent and mute`).toBe(true);
            // Nobody has taken one, so there is no material and no price.
            expect(b.materialIds, `${b.id} has been priced`).toEqual([]);
            expect(coreOf(b.id)).toBeUndefined();
        }
    });

    it('describes the road as a road, not as a third tradition', () => {
        const road = `${THE_BEAST_ROAD.method} ${THE_BEAST_ROAD.rate} ${THE_BEAST_ROAD.theChange}`;
        expect(road).toMatch(/no manual|no teacher/i);
        expect(THE_BEAST_ROAD.rate).toMatch(/never stops|does not stop/i);
        expect(THE_BEAST_ROAD.whyTheyAreHunted).toMatch(/core/i);
        expect(THE_BEAST_ROAD.death).toMatch(/nothing comes back|no nascent soul/i);
        expect(THE_BEAST_ROAD.whatTheyLack.length).toBeGreaterThanOrEqual(3);
        expect(THE_BEAST_ROAD.whatTheyHave.join(' ')).toMatch(/time/i);
    });

    it('says how a cultivator estimates one, and how the reading fails', () => {
        expect(ESTIMATING_A_BEAST.tells.length).toBeGreaterThanOrEqual(3);
        expect(ESTIMATING_A_BEAST.tells.join(' ')).toMatch(/Core Formation/);
        expect(ESTIMATING_A_BEAST.standardError).toMatch(/rank low|survey/i);
    });
});

describe('they live where the qi is', () => {
    it('puts something on the veins, so good ground is contested first', () => {
        const contenders = veinContenders();
        expect(contenders.length, 'nothing competes for a vein').toBeGreaterThanOrEqual(3);
        // A vein is not merely occupied; some of them are a competing draw.
        expect(contenders.some(b => b.veinRelation === 'drains')).toBe(true);
        expect(contenders.some(b => b.veinRelation === 'holds')).toBe(true);
        // The richest ground carries the highest ordinals in the catalog.
        const onVeins = BEASTS.filter(b => b.biome === 'spirit_vein');
        expect(onVeins.length).toBeGreaterThanOrEqual(2);
        const meanOnVein = onVeins.reduce((s, b) => s + b.ordinal, 0) / onVeins.length;
        const meanOverall = BEASTS.reduce((s, b) => s + b.ordinal, 0) / BEASTS.length;
        expect(meanOnVein, 'vein ground is not more dangerous than average').toBeGreaterThan(meanOverall);
    });

    it('makes the vein-only population unavailable on ordinary ground', () => {
        for (const b of BEASTS.filter(x => x.persistence === 'vein_only')) {
            expect(b.veinRelation, `${b.id} is vein-only and indifferent to veins`).not.toBe('indifferent');
        }
    });
});

describe('the Late Age applies to them as well', () => {
    it('leaves drawn-down ground with thin, degenerate populations', () => {
        const remnant = BEASTS.filter(b => b.persistence === 'thin_remnant');
        expect(remnant.length, 'nothing has been drawn down').toBeGreaterThanOrEqual(2);
        for (const b of remnant) {
            expect(b.ordinal, `${b.id} is a thin remnant and formidable`).toBeLessThanOrEqual(12);
        }
        // And the catalog says so about the ground rather than the animal.
        expect(remnant.map(b => `${b.hard} ${b.note}`).join(' '))
            .toMatch(/survey|record|generations|half the size|undersized|ceiling/i);
    });

    it('keeps the impressive things behind seals', () => {
        const sealed = sealedOnlyBeasts();
        expect(sealed.length).toBeGreaterThanOrEqual(2);
        const openWorldMax = Math.max(
            ...BEASTS.filter(b => b.persistence === 'open_world').map(b => b.ordinal)
        );
        for (const b of sealed) {
            expect(b.ordinal, `${b.id} is sealed away and no stronger than the open world`)
                .toBeGreaterThan(openWorldMax);
        }
    });

    it('has something older than the institution standing on top of it', () => {
        const ancient = getBeastsByNature('ancient');
        expect(ancient.length).toBeGreaterThanOrEqual(1);
        expect(ancient.length, 'ancient sleepers stop being terrible if there is a roster')
            .toBeLessThanOrEqual(3);
        for (const b of ancient) {
            expect(b.persistence).toBe('sealed_only');
            expect(b.ordinal).toBeGreaterThanOrEqual(28);
            expect(`${b.hard} ${b.note}`, `${b.id} does not predate anything`)
                .toMatch(/before|since|years|founded|nine hundred/i);
        }
    });
});

describe('beast materials feed the existing economy', () => {
    it('parses, resolves to a real beast, and the beast claims it back', () => {
        expect(BEAST_MATERIALS.length).toBeGreaterThanOrEqual(12);
        expect(new Set(BEAST_MATERIALS.map(m => m.id)).size).toBe(BEAST_MATERIALS.length);
        for (const m of BEAST_MATERIALS) {
            expect(() => BeastMaterialSchema.parse(m), m.id).not.toThrow();
            expect(BEAST_IDS.has(m.sourceBeastId), `${m.id} comes off nothing`).toBe(true);
            expect(requireBeast(m.sourceBeastId).materialIds, `${m.id} is disowned`).toContain(m.id);
        }
        // And every id a beast names resolves.
        for (const b of BEASTS) {
            for (const id of b.materialIds) {
                expect(getBeastMaterial(id), `${b.id} names missing material ${id}`).toBeDefined();
            }
            expect(materialsOf(b.id).length).toBe(b.materialIds.length);
        }
        expect(materialsOf('beast-nothing')).toEqual([]);
    });

    it('prices in the herb catalog\'s bands rather than inventing a second ladder', () => {
        for (const m of BEAST_MATERIALS) {
            const band = HERB_VALUE_BANDS[m.grade];
            expect(m.value, `${m.id} is outside the ${m.grade} band`).toBeGreaterThanOrEqual(band.min);
            expect(m.value, `${m.id} is outside the ${m.grade} band`).toBeLessThanOrEqual(band.max);
            expect(m.rarityWeight, `${m.id} is too common for ${m.grade}`)
                .toBeLessThanOrEqual(HERB_RARITY_CEILING[m.grade]);
        }
    });

    it('makes taking it cost what the thing it came off was worth', () => {
        for (const m of BEAST_MATERIALS) {
            const beast = requireBeast(m.sourceBeastId);
            if (m.taking === 'kill') {
                expect(m.harvestOrdinal, `${m.id} is killed for below its own realm`).toBe(beast.ordinal);
            } else {
                expect(m.harvestOrdinal, `${m.id} is shed or scavenged and priced as a kill`)
                    .toBeLessThan(beast.ordinal);
            }
        }
        // The bottom of the trade has to be reachable by somebody poor.
        const reachableAtNothing = BEAST_MATERIALS.filter(m => m.harvestOrdinal <= 3);
        expect(reachableAtNothing.length, 'nothing here is affordable work').toBeGreaterThanOrEqual(3);
        expect(BEAST_MATERIALS.some(m => m.taking === 'shed')).toBe(true);
        expect(BEAST_MATERIALS.some(m => m.taking === 'scavenge')).toBe(true);
    });

    it('carries at most one core per beast, and none below the change', () => {
        for (const b of BEASTS) {
            const cores = materialsOf(b.id).filter(m => m.core);
            expect(cores.length, `${b.id} has ${cores.length} cores`).toBeLessThanOrEqual(1);
            if (b.ordinal < BEAST_CHANGE_ORDINAL) {
                expect(cores.length, `${b.id} has a core below the change`).toBe(0);
            }
            expect(coreOf(b.id)?.id).toBe(cores[0]?.id);
        }
        // A core is worth more than anything else off the same animal.
        for (const m of BEAST_MATERIALS.filter(x => x.core)) {
            const others = materialsOf(m.sourceBeastId).filter(x => !x.core);
            for (const other of others) {
                expect(m.value, `${other.id} outprices the core`).toBeGreaterThan(other.value);
            }
        }
    });
});

describe('a beast tide is a regional event with a cause', () => {
    it('parses, sits in a real region, and states why it is happening', () => {
        expect(BEAST_TIDES.length).toBeGreaterThanOrEqual(3);
        const regionIds = new Set(REGIONS.map(r => r.id));
        for (const t of BEAST_TIDES) {
            expect(() => BeastTideSchema.parse(t), t.id).not.toThrow();
            expect(regionIds.has(t.regionId), `${t.id} is nowhere`).toBe(true);
            expect(t.cause.length, `${t.id} has no cause`).toBeGreaterThan(80);
            expect(t.minOrdinal).toBeLessThanOrEqual(t.maxOrdinal);
            expect(beastsInTide(t.id).length, `${t.id} is empty`).toBeGreaterThanOrEqual(2);
            for (const b of beastsInTide(t.id)) {
                expect(b.ordinal, `${b.id} is outside the window of ${t.id}`).toBeLessThanOrEqual(t.maxOrdinal);
            }
        }
        expect(getBeastTide('tide-nothing')).toBeUndefined();
        expect(beastsInTide('tide-nothing')).toEqual([]);
        expect(tidesInRegion('region-low-fall').length).toBeGreaterThanOrEqual(1);
        expect(tidesInRegion('region-quiet-marches').length).toBeGreaterThanOrEqual(1);
    });

    it('is a symptom: the cause is ground or a seal, never appetite', () => {
        for (const t of BEAST_TIDES) {
            expect(t.cause, `${t.id} has no physical cause`)
                .toMatch(/vein|seal|burn edge|ground|moved|drawn/i);
            expect(t.precursors.length, `${t.id} arrives without warning`).toBeGreaterThanOrEqual(2);
            expect(t.whoAbsorbsIt.length).toBeGreaterThan(60);
            expect(t.aftermath.length).toBeGreaterThan(60);
        }
        // At least one has nothing at the back of it to kill, which is worse.
        expect(BEAST_TIDES.some(t => t.driverBeastId === null)).toBe(true);
        // And where there is a driver, it is a beast in this catalog.
        for (const t of BEAST_TIDES) {
            if (t.driverBeastId) expect(BEAST_IDS.has(t.driverBeastId), t.id).toBe(true);
        }
    });

    it('keeps at least one cause unknown to the people it is happening to', () => {
        expect(BEAST_TIDES.some(t => !t.causeKnownLocally)).toBe(true);
    });
});

describe('a contract is rare, costly and mutual', () => {
    it('is never phrased as acquiring a pet', () => {
        const text = [
            THE_CONTRACT.whyItIsRare,
            THE_CONTRACT.witnessing,
            THE_CONTRACT.whatItIsWorth,
            ...THE_CONTRACT.whatItIsNot,
            ...THE_CONTRACT.whatTheBeastWants,
            ...THE_CONTRACT.whatTheCultivatorGives,
            ...THE_CONTRACT.howItBreaks
        ].join(' ');
        for (const banned of [/\bpet\b/i, /\btame[ds]?\b/i, /\bmount\b/i, /\bown(s|ed)? it\b/i, /\bcapture[ds]?\b/i]) {
            expect(banned.test(text), `the contract reads as acquisition: ${banned}`).toBe(false);
        }
        expect(THE_CONTRACT.whatItIsNot.join(' ')).toMatch(/not a purchase/i);
        expect(THE_CONTRACT.whatItIsNot.join(' ')).toMatch(/not obedience/i);
    });

    it('costs both sides, and the cultivator pays in their own draw', () => {
        expect(THE_CONTRACT.whatTheBeastWants.length).toBeGreaterThanOrEqual(3);
        expect(THE_CONTRACT.whatTheCultivatorGives.length).toBeGreaterThanOrEqual(3);
        // The cost is the contested-qi rule, applied honestly.
        expect(THE_CONTRACT.whatTheCultivatorGives.join(' ')).toMatch(/share of their own draw/i);
        expect(THE_CONTRACT.whatItIsWorth).toMatch(/tax|permanent/i);
        // It binds only when witnessed, like every other agreement.
        expect(THE_CONTRACT.witnessing).toMatch(/Bound Word|witness/i);
        // And it can end, in stated ways, one of which is being outgrown.
        expect(THE_CONTRACT.howItBreaks.length).toBeGreaterThanOrEqual(3);
        expect(THE_CONTRACT.howItBreaks.join(' ')).toMatch(/outgrow/i);
    });

    it('says what the engine would need before it could resolve', () => {
        expect(CONTRACT_ENGINE_REQUIREMENTS.length).toBeGreaterThanOrEqual(4);
        const reqs = CONTRACT_ENGINE_REQUIREMENTS.join(' ');
        expect(reqs).toMatch(/cultivation rate|draw share/i);
        expect(reqs).toMatch(/realmOrdinal|progress/i);
        expect(reqs).toMatch(/oath|penalty clause|witness/i);
    });
});

describe('lookups', () => {
    it('separates what can be taken from what is above the cultivator', () => {
        for (const ordinal of [0, 5, 13, 21, 33, 44]) {
            const takeable = findBeastsForOrdinal(ordinal);
            const above = findThreatsAboveOrdinal(ordinal);
            expect(takeable.length + above.length).toBe(BEASTS.length);
            for (const b of takeable) expect(b.ordinal).toBeLessThanOrEqual(ordinal);
            for (const b of above) expect(b.ordinal).toBeGreaterThan(ordinal);
        }
        // The lowest realm in the world can take the hare and nothing else.
        expect(findBeastsForOrdinal(0).map(b => b.id)).toEqual(['beast-stubble-hare']);
        expect(findThreatsAboveOrdinal(MAX_ORDINAL)).toEqual([]);
        // Clamped, not thrown.
        expect(findBeastsForOrdinal(-5)).toEqual(findBeastsForOrdinal(0));
        expect(findBeastsForOrdinal(Number.NaN)).toEqual(findBeastsForOrdinal(0));
        expect(findBeastsForOrdinal(21, 'glacier').every(b => b.biome === 'glacier')).toBe(true);
        expect(rollBeast(0, 0.5, 'abyss')).toBeUndefined();
    });

    it('reports its own size to the catalog counts', () => {
        const counts = getCultivationCatalogCounts();
        expect(counts.beasts).toBe(BEASTS.length);
        expect(counts.beastMaterials).toBe(BEAST_MATERIALS.length);
        expect(counts.beastTides).toBe(BEAST_TIDES.length);
    });
});

describe('wired into the encounter table', () => {
    const ADDED = [
        'enc-thin-district-beasts',
        'enc-culling-notice-mispriced',
        'enc-beast-hunting-cultivators',
        'enc-beast-holding-a-vein',
        'enc-beast-tide',
        'enc-beast-that-speaks',
        'enc-beast-contract-offered',
        'enc-old-thing-under-the-compound',
        'enc-beast-core-assay'
    ];

    it('registers every new entry against the existing conventions', () => {
        for (const id of ADDED) {
            const e = getEncounter(id);
            expect(e, `${id} is not registered`).toBeDefined();
            expect(e!.weight).toBeGreaterThan(0);
            expect(e!.minOrdinal).toBeLessThanOrEqual(e!.maxOrdinal);
            // Facts only, and the tokens are declared exactly.
            expect(/\byou\b|\byour\b/i.test(e!.summaryTemplate), `${id} narrates`).toBe(false);
            const used = new Set([...e!.summaryTemplate.matchAll(/\{(\w+)\}/gu)].map(m => m[1]));
            expect([...used].sort()).toEqual([...e!.tokens].sort());
        }
    });

    it('covers the same ground the beast catalog does', () => {
        // A tide, with a cause slot rather than a spawn count alone.
        expect(getEncounter('enc-beast-tide')!.tokens).toContain('cause');
        // Something that specifically hunts cultivators and leaves mortals.
        expect(getEncounter('enc-beast-hunting-cultivators')!.summaryTemplate)
            .toMatch(/cores taken|no mortal/i);
        // Territorial about a vein, with the output loss stated.
        expect(getEncounter('enc-beast-holding-a-vein')!.tags).toContain('spirit-vein');
        // Negotiable, and the Core Formation floor is in the summary.
        expect(getEncounter('enc-beast-that-speaks')!.summaryTemplate).toMatch(/Core Formation/);
        expect(getEncounter('enc-beast-that-speaks')!.tags).toContain('negotiable');
        // The contract is expensive on the cultivator's own draw.
        expect(getEncounter('enc-beast-contract-offered')!.summaryTemplate).toMatch(/own draw/i);
        // The Late Age version: thin ground, small animals, poor pay.
        expect(getEncounter('enc-thin-district-beasts')!.tags).toContain('late-age');
        // And an ancient sleeper under somebody's compound.
        expect(getEncounter('enc-old-thing-under-the-compound')!.summaryTemplate)
            .toMatch(/before .* was founded/i);
    });

    it('does not demote digging below the share the loop needs', () => {
        for (const ordinal of [0, 5, 10, 20, 30, 40, 44]) {
            expect(ruinWeightShare(ordinal), `digging is marginal at ordinal ${ordinal}`)
                .toBeGreaterThan(0.2);
        }
    });

    it('leaves the beast block a real presence rather than a garnish', () => {
        const beasts = ENCOUNTERS.filter(e => e.kind === 'spirit_beast');
        expect(beasts.length).toBeGreaterThanOrEqual(15);
        // Some of them are not fights, which is the point of the whole file.
        expect(beasts.some(e => e.threatOrdinal === null)).toBe(true);
        expect(beasts.some(e => e.tags.includes('negotiable'))).toBe(true);
    });
});
