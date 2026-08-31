/**
 * Encounter and opportunity tables for the time-skip simulation.
 *
 * "I cultivate for ten years" is resolved in one deterministic pass, and this
 * is the table that pass draws from. Nothing here is prose: `summaryTemplate`
 * is an ENGINE-AUTHORED FACTUAL SUMMARY with `{token}` slots the engine fills
 * with resolved numbers. The runtime agent turns the resulting fact line into
 * narration; it never invents the facts, and it never sees a sentence here that
 * was already trying to be a story.
 *
 * Compare `SimEventSchema.summary` in `src/schema/cultivation.ts` - a filled
 * template is exactly what belongs in that field.
 *
 * WEIGHTING
 * ---------
 * `weight` is a relative draw weight within the set of entries whose ordinal
 * range contains the cultivator. Ranges overlap heavily on purpose: a Qi
 * Condensation cultivator meets bandits and untouched herb patches, a Nascent
 * Soul cultivator meets sect wars and sealed tombs, and the handful of entries
 * that span the whole ladder - qi deviation, being robbed in seclusion - are
 * the reminders that nothing is ever fully outgrown.
 *
 * `threatOrdinal` is the realm ordinal of whatever is hostile, or null when the
 * entry is not a fight. The engine compares it to the cultivator's own ordinal;
 * the power multipliers in `realms.ts` are steep enough that a four-rank gap is
 * not a hard fight, it is a death.
 *
 * RUINS ARE THE CORE LOOP
 * -----------------------
 * This is a late age. Most veins have been drawn down, whole regions were
 * killed outright by old wars, and nobody has ascended in living memory. A
 * sealed site is a pocket of qi that nothing has drawn on, along with whatever
 * its owner did not get to take out - manuals in grades no living teacher can
 * transmit, refining methods nobody alive devised, and formations still
 * drawing on a vein that was rich when it was tapped.
 *
 * That makes digging the only realistic path upward for a cultivator born
 * without talent, or born somewhere poor, so the `ruin` and `grave` entries
 * below are the heaviest
 * block in the table by weight, not a garnish on it. They are also the most
 * specific way to die: seals punish the wrong opening method, guardian
 * formations have been running for two ages without tiring, corpses in the
 * inner chambers are still cultivating, and inheritance trials were calibrated
 * for the disciples of a sect that no longer exists.
 *
 * Ruins are ordinary. A village granary is built against a wall it did not
 * make; farmers plough up fragments and sell them by weight; a child's toy is a
 * spirit tool with the qi long gone out of it. Nobody finds this remarkable,
 * and the summaries here should not either.
 */

import { z } from 'zod';
import { SimEventKindSchema, type SimEventKind } from '../../schema/cultivation.js';
import { MAX_ORDINAL, TOTAL_RANKS } from '../../engine/cultivation/realms.js';

/** Coarse classification, for filtering and for rumour/log grouping. */
export const EncounterKindSchema = z.enum([
    'bandits',
    'rival_cultivator',
    'spirit_beast',
    'ruin',
    'grave',
    'dao_house',
    'opportunity',
    'commerce',
    'sect_event',
    'misfortune'
]);
export type EncounterKind = z.infer<typeof EncounterKindSchema>;

export const EncounterEntrySchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    kind: EncounterKindSchema,
    /** The SimEvent kind the engine should emit when this entry fires. */
    simEventKind: SimEventKindSchema,
    /** Relative draw weight among eligible entries. */
    weight: z.number().int().min(1),
    /** Inclusive realm-ordinal window in which this entry is appropriate. */
    minOrdinal: z.number().int().min(0).max(MAX_ORDINAL),
    maxOrdinal: z.number().int().min(0).max(MAX_ORDINAL),
    /** True when the entry should stop a time-skip and hand control back. */
    interrupts: z.boolean(),
    /** Realm ordinal of the hostile party, or null when nothing is hostile. */
    threatOrdinal: z.number().int().min(0).max(MAX_ORDINAL).nullable(),
    /**
     * Engine-authored factual summary with `{token}` slots. Facts only - no
     * narration, no adjectives the engine cannot substantiate.
     */
    summaryTemplate: z.string().min(1),
    /** Every token appearing in the template, declared so the engine can fill it. */
    tokens: z.array(z.string()),
    tags: z.array(z.string())
});
export type EncounterEntry = z.infer<typeof EncounterEntrySchema>;

export const ENCOUNTERS: readonly EncounterEntry[] = [
    // ═══════════════════════════════════════════════════════════════════
    // BANDITS AND MORTAL TROUBLE
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'enc-roadside-bandits',
        name: 'Roadside Bandits',
        kind: 'bandits',
        simEventKind: 'encounter',
        weight: 120,
        minOrdinal: 0,
        maxOrdinal: 8,
        interrupts: true,
        threatOrdinal: 2,
        summaryTemplate:
            '{count} bandits block the road at {place}. Strongest is {threatRank}. They demand {stones} spirit stones to let the road pass.',
        tokens: ['count', 'place', 'threatRank', 'stones'],
        tags: ['hostile', 'road', 'negotiable']
    },
    {
        id: 'enc-bandit-toll-post',
        name: 'Illegal Toll Post',
        kind: 'bandits',
        simEventKind: 'encounter',
        weight: 80,
        minOrdinal: 0,
        maxOrdinal: 10,
        interrupts: true,
        threatOrdinal: 4,
        summaryTemplate:
            'An unsanctioned toll post has been erected at {place}, manned by {count} armed cultivators under a leader at {threatRank}. Toll demanded: {stones} spirit stones.',
        tokens: ['place', 'count', 'threatRank', 'stones'],
        tags: ['hostile', 'road', 'negotiable']
    },
    {
        id: 'enc-bandit-cultivator-leader',
        name: 'Bandit Chief with Cultivation',
        kind: 'bandits',
        simEventKind: 'encounter',
        weight: 45,
        minOrdinal: 4,
        maxOrdinal: 14,
        interrupts: true,
        threatOrdinal: 9,
        summaryTemplate:
            'A bandit band of {count} at {place} is led by a cultivator at {threatRank}, above the rest of the band by {gap} ranks. They are hunting travellers carrying pills.',
        tokens: ['count', 'place', 'threatRank', 'gap'],
        tags: ['hostile', 'road']
    },
    {
        id: 'enc-caravan-under-attack',
        name: 'Caravan Under Attack',
        kind: 'bandits',
        simEventKind: 'encounter',
        weight: 40,
        minOrdinal: 2,
        maxOrdinal: 14,
        interrupts: true,
        threatOrdinal: 6,
        summaryTemplate:
            'A merchant caravan is under attack at {place} by {count} raiders at {threatRank}. The caravan master offers {stones} spirit stones for intervention. Two guards are already down.',
        tokens: ['place', 'count', 'threatRank', 'stones'],
        tags: ['hostile', 'reward', 'reputation', 'timed']
    },
    {
        id: 'enc-press-gang',
        name: 'Conscription Press Gang',
        kind: 'bandits',
        simEventKind: 'npc_event',
        weight: 30,
        minOrdinal: 0,
        maxOrdinal: 6,
        interrupts: true,
        threatOrdinal: 5,
        summaryTemplate:
            'A press gang from {faction} is taking low-realm cultivators at {place} for a border garrison. Refusal is recorded as desertion. Term of service: {years} years.',
        tokens: ['faction', 'place', 'years'],
        tags: ['hostile', 'social', 'time-cost']
    },

    // ═══════════════════════════════════════════════════════════════════
    // RIVAL CULTIVATORS
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'enc-duel-challenge',
        name: 'Duel Challenge',
        kind: 'rival_cultivator',
        simEventKind: 'encounter',
        weight: 70,
        minOrdinal: 2,
        maxOrdinal: 20,
        interrupts: true,
        threatOrdinal: 8,
        summaryTemplate:
            'A cultivator named {name} at {threatRank} issues a formal duel challenge at {place}. Stakes named: {stakes}. Refusal is public and will be reported.',
        tokens: ['name', 'threatRank', 'place', 'stakes'],
        tags: ['hostile', 'social', 'reputation', 'avoidable']
    },
    {
        id: 'enc-territorial-disciple',
        name: 'Territorial Sect Disciple',
        kind: 'rival_cultivator',
        simEventKind: 'encounter',
        weight: 55,
        minOrdinal: 5,
        maxOrdinal: 22,
        interrupts: true,
        threatOrdinal: 12,
        summaryTemplate:
            'A disciple of {faction} at {threatRank} claims the herb ground at {place} as sect territory and orders departure within the hour.',
        tokens: ['faction', 'threatRank', 'place'],
        tags: ['hostile', 'territory', 'avoidable']
    },
    {
        id: 'enc-old-feud-ambush',
        name: 'Old Feud Comes Due',
        kind: 'rival_cultivator',
        simEventKind: 'encounter',
        weight: 25,
        minOrdinal: 6,
        maxOrdinal: 30,
        interrupts: true,
        threatOrdinal: 14,
        summaryTemplate:
            '{name}, holding a standing grudge from {grudgeSource}, has located the cultivator at {place} and arrives at {threatRank} with {count} companions. No terms offered.',
        tokens: ['name', 'grudgeSource', 'place', 'threatRank', 'count'],
        tags: ['hostile', 'feud', 'unavoidable']
    },
    {
        id: 'enc-demonic-harvester',
        name: 'Demonic Cultivator Harvesting',
        kind: 'rival_cultivator',
        simEventKind: 'encounter',
        weight: 30,
        minOrdinal: 8,
        maxOrdinal: 28,
        interrupts: true,
        threatOrdinal: 18,
        summaryTemplate:
            'A demonic cultivator of {faction} at {threatRank} is harvesting cultivation from low-realm victims near {place}. {count} bodies found so far, all with torn meridians.',
        tokens: ['faction', 'threatRank', 'place', 'count'],
        tags: ['hostile', 'demonic', 'reputation']
    },
    {
        id: 'enc-wandering-swordsman-spar',
        name: 'Wandering Swordsman Offers a Spar',
        kind: 'rival_cultivator',
        simEventKind: 'encounter',
        weight: 45,
        minOrdinal: 3,
        maxOrdinal: 24,
        interrupts: true,
        threatOrdinal: 10,
        summaryTemplate:
            'A wandering cultivator, {name} at {threatRank}, offers a non-lethal spar at {place}. Declared stake: instruction in {techniqueName} if the challenger lands one clean strike.',
        tokens: ['name', 'threatRank', 'place', 'techniqueName'],
        tags: ['non-lethal', 'reward', 'avoidable', 'technique']
    },
    {
        id: 'enc-core-elder-passing',
        name: 'Core Formation Elder Passing Through',
        kind: 'rival_cultivator',
        simEventKind: 'encounter',
        weight: 20,
        minOrdinal: 13,
        maxOrdinal: 26,
        interrupts: true,
        threatOrdinal: 19,
        summaryTemplate:
            'An elder of {faction} at {threatRank} passes through {place} and takes notice. Realm gap: {gap} ranks. The elder has issued no threat and requires no reply.',
        tokens: ['faction', 'threatRank', 'place', 'gap'],
        tags: ['power-gap', 'social', 'avoidable']
    },
    {
        id: 'enc-nascent-soul-pressure',
        name: 'Nascent Soul Pressure',
        kind: 'rival_cultivator',
        simEventKind: 'encounter',
        weight: 15,
        minOrdinal: 21,
        maxOrdinal: 36,
        interrupts: true,
        threatOrdinal: 30,
        summaryTemplate:
            'A cultivator at {threatRank} releases realm pressure across {place}, {gap} ranks above the observer. Everything below Nascent Soul in the area is immobilised for the duration.',
        tokens: ['threatRank', 'place', 'gap'],
        tags: ['power-gap', 'unavoidable']
    },

    // ═══════════════════════════════════════════════════════════════════
    // SPIRIT BEASTS
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'enc-spirit-wolf-pack',
        name: 'Spirit Wolf Pack',
        kind: 'spirit_beast',
        simEventKind: 'encounter',
        weight: 90,
        minOrdinal: 0,
        maxOrdinal: 10,
        interrupts: true,
        threatOrdinal: 3,
        summaryTemplate:
            '{count} spirit wolves, individually at {threatRank}, are hunting as a pack at {place}. They do not scatter when one falls.',
        tokens: ['count', 'threatRank', 'place'],
        tags: ['hostile', 'beast', 'materials']
    },
    {
        id: 'enc-ironhide-boar',
        name: 'Ironhide Boar',
        kind: 'spirit_beast',
        simEventKind: 'encounter',
        weight: 70,
        minOrdinal: 1,
        maxOrdinal: 12,
        interrupts: true,
        threatOrdinal: 5,
        summaryTemplate:
            'An ironhide boar at {threatRank} is rooting through the {place} herb ground. Its hide is worth {stones} spirit stones intact.',
        tokens: ['threatRank', 'place', 'stones'],
        tags: ['hostile', 'beast', 'materials', 'avoidable']
    },
    {
        id: 'enc-mist-serpent',
        name: 'Venomous Mist Serpent',
        kind: 'spirit_beast',
        simEventKind: 'encounter',
        weight: 50,
        minOrdinal: 5,
        maxOrdinal: 16,
        interrupts: true,
        threatOrdinal: 10,
        summaryTemplate:
            'A mist serpent at {threatRank} has denned in the marsh at {place}. Its exhalation is poisonous within {range} paces and lingers.',
        tokens: ['threatRank', 'place', 'range'],
        tags: ['hostile', 'beast', 'poison']
    },
    {
        id: 'enc-cave-bat-swarm',
        name: 'Qi-Draining Bat Swarm',
        kind: 'spirit_beast',
        simEventKind: 'encounter',
        weight: 45,
        minOrdinal: 2,
        maxOrdinal: 14,
        interrupts: true,
        threatOrdinal: 6,
        summaryTemplate:
            'A swarm of roughly {count} qi-draining bats occupies the cave at {place}. Individually negligible at {threatRank}; collectively they empty a qi pool in minutes.',
        tokens: ['count', 'place', 'threatRank'],
        tags: ['hostile', 'beast', 'qi-drain', 'avoidable']
    },
    {
        id: 'enc-thunder-hawk',
        name: 'Thunder Hawk',
        kind: 'spirit_beast',
        simEventKind: 'encounter',
        weight: 30,
        minOrdinal: 10,
        maxOrdinal: 24,
        interrupts: true,
        threatOrdinal: 17,
        summaryTemplate:
            'A thunder hawk at {threatRank} is nesting above {place}. Its nest contains {count} spirit eggs. It attacks anything that flies within sight of the ledge.',
        tokens: ['threatRank', 'place', 'count'],
        tags: ['hostile', 'beast', 'materials', 'lightning', 'avoidable']
    },
    {
        id: 'enc-glacier-lynx',
        name: 'Glacier Lynx',
        kind: 'spirit_beast',
        simEventKind: 'encounter',
        weight: 22,
        minOrdinal: 12,
        maxOrdinal: 26,
        interrupts: true,
        threatOrdinal: 19,
        summaryTemplate:
            'A glacier lynx at {threatRank} is stalking the ice field at {place}. It has been following for {days} days without closing.',
        tokens: ['threatRank', 'place', 'days'],
        tags: ['hostile', 'beast', 'ice', 'materials']
    },
    {
        id: 'enc-earth-dragon-juvenile',
        name: 'Juvenile Earth Dragon',
        kind: 'spirit_beast',
        simEventKind: 'encounter',
        weight: 12,
        minOrdinal: 18,
        maxOrdinal: 32,
        interrupts: true,
        threatOrdinal: 26,
        summaryTemplate:
            'A juvenile earth dragon at {threatRank} has broken into the spirit vein under {place} and is feeding. Vein output has fallen {percent} percent since it arrived.',
        tokens: ['threatRank', 'place', 'percent'],
        tags: ['hostile', 'beast', 'spirit-vein', 'materials']
    },
    {
        id: 'enc-abyssal-leviathan',
        name: 'Abyssal Leviathan',
        kind: 'spirit_beast',
        simEventKind: 'encounter',
        weight: 4,
        minOrdinal: 28,
        maxOrdinal: 44,
        interrupts: true,
        threatOrdinal: 38,
        summaryTemplate:
            'A leviathan at {threatRank} has surfaced from the rift at {place}. Realm gap to the observer: {gap} ranks. {count} settlements are inside its recorded range.',
        tokens: ['threatRank', 'place', 'gap', 'count'],
        tags: ['hostile', 'beast', 'catastrophe']
    },
    {
        id: 'enc-guarded-herb',
        name: 'Guarded Spirit Herb',
        kind: 'spirit_beast',
        simEventKind: 'opportunity',
        weight: 25,
        minOrdinal: 6,
        maxOrdinal: 30,
        interrupts: true,
        threatOrdinal: 16,
        summaryTemplate:
            'A mature {herbName} is growing at {place}, guarded by a spirit beast at {threatRank}. Herb market value: {stones} spirit stones. The beast does not leave the site.',
        tokens: ['herbName', 'place', 'threatRank', 'stones'],
        tags: ['hostile', 'beast', 'herb', 'avoidable']
    },

    // ═══════════════════════════════════════════════════════════════════
    // RUINS, OPPORTUNITIES, INHERITANCES
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'enc-abandoned-cave-dwelling',
        name: 'Abandoned Cave Dwelling',
        kind: 'ruin',
        simEventKind: 'opportunity',
        weight: 60,
        minOrdinal: 0,
        maxOrdinal: 14,
        interrupts: false,
        threatOrdinal: null,
        summaryTemplate:
            'An abandoned cultivation cave is found at {place}, unoccupied for roughly {years} years. Ambient qi inside: {ambient}. Contents recovered: {loot}.',
        tokens: ['place', 'years', 'ambient', 'loot'],
        tags: ['shelter', 'loot', 'safe']
    },
    {
        id: 'enc-untouched-herb-patch',
        name: 'Untouched Herb Patch',
        kind: 'opportunity',
        simEventKind: 'opportunity',
        weight: 80,
        minOrdinal: 0,
        maxOrdinal: 20,
        interrupts: false,
        threatOrdinal: null,
        summaryTemplate:
            'An unpicked stand of {herbName} is found at {place}. Yield: {count}. Combined market value: {stones} spirit stones.',
        tokens: ['herbName', 'place', 'count', 'stones'],
        tags: ['herb', 'loot', 'safe']
    },
    {
        id: 'enc-dead-cultivator-pouch',
        name: 'Dead Cultivator, Intact Pouch',
        kind: 'ruin',
        simEventKind: 'opportunity',
        weight: 40,
        minOrdinal: 2,
        maxOrdinal: 24,
        interrupts: false,
        threatOrdinal: null,
        summaryTemplate:
            'A cultivator dead approximately {days} days is found at {place}, at {threatRank} in life. Storage pouch intact: {stones} spirit stones and {loot}. Cause of death: {cause}.',
        tokens: ['days', 'place', 'threatRank', 'stones', 'loot', 'cause'],
        tags: ['loot', 'safe', 'foreshadowing']
    },
    {
        id: 'enc-sealed-tomb',
        name: 'Sealed Tomb Entrance',
        kind: 'ruin',
        simEventKind: 'opportunity',
        weight: 18,
        minOrdinal: 10,
        maxOrdinal: 32,
        interrupts: true,
        threatOrdinal: null,
        summaryTemplate:
            'A sealed tomb entrance is exposed at {place}, dated roughly {years} years old and warded at {wardOrdinal}. The seal is intact. {count} other parties are camped within sight of it.',
        tokens: ['place', 'years', 'wardOrdinal', 'count'],
        tags: ['ruin', 'competition', 'high-risk']
    },
    {
        id: 'enc-spirit-vein-fissure',
        name: 'Exposed Spirit Vein Fissure',
        kind: 'opportunity',
        simEventKind: 'opportunity',
        weight: 14,
        minOrdinal: 8,
        maxOrdinal: 34,
        interrupts: false,
        threatOrdinal: null,
        summaryTemplate:
            'A spirit vein fissure is open at {place}. Ambient qi at the fissure: {ambient}. Estimated stability: {days} days before it closes or is claimed.',
        tokens: ['place', 'ambient', 'days'],
        tags: ['cultivation-rate', 'timed', 'safe']
    },
    {
        id: 'enc-ancient-battlefield-relics',
        name: 'Ancient Battlefield Relics',
        kind: 'ruin',
        simEventKind: 'opportunity',
        weight: 16,
        minOrdinal: 12,
        maxOrdinal: 34,
        interrupts: false,
        threatOrdinal: null,
        summaryTemplate:
            'A battlefield roughly {years} years old is exposed by erosion at {place}. Recoverable: {loot}. Residual death qi present; extended exposure carries deviation risk.',
        tokens: ['years', 'place', 'loot'],
        tags: ['loot', 'deviation-risk', 'herb']
    },
    {
        id: 'enc-immortal-inheritance-trial',
        name: 'Immortal Inheritance Trial',
        kind: 'ruin',
        simEventKind: 'opportunity',
        weight: 5,
        minOrdinal: 16,
        maxOrdinal: 40,
        interrupts: true,
        threatOrdinal: null,
        summaryTemplate:
            'An inheritance ground at {place} has opened and admits one claimant. The trial is set at {wardOrdinal}. Declared prize: {loot}. Failure conditions are not disclosed by the ground.',
        tokens: ['place', 'wardOrdinal', 'loot'],
        tags: ['inheritance', 'technique', 'high-risk', 'once']
    },
    {
        id: 'enc-secret-realm-opening',
        name: 'Secret Realm Opening',
        kind: 'ruin',
        simEventKind: 'opportunity',
        weight: 6,
        minOrdinal: 20,
        maxOrdinal: 40,
        interrupts: true,
        threatOrdinal: null,
        summaryTemplate:
            'A secret realm opens at {place} and will remain open {days} days. Entry ordinal cap: {wardOrdinal}. {count} sects have already sent parties.',
        tokens: ['place', 'days', 'wardOrdinal', 'count'],
        tags: ['ruin', 'competition', 'timed', 'high-risk']
    },
    {
        id: 'enc-fallen-star-crater',
        name: 'Fallen Star Crater',
        kind: 'ruin',
        simEventKind: 'opportunity',
        weight: 3,
        minOrdinal: 24,
        maxOrdinal: 42,
        interrupts: true,
        threatOrdinal: null,
        summaryTemplate:
            'Something struck the ground at {place} {days} days ago and left a crater {range} paces across. Material recovered so far: {loot}. Three parties have arrived; two have not left.',
        tokens: ['place', 'days', 'range', 'loot'],
        tags: ['ruin', 'competition', 'materials', 'high-risk']
    },

    // ═══════════════════════════════════════════════════════════════════
    // THE LATE AGE: ORDINARY RUINS
    // The wreckage is not a dungeon. It is the landscape, and the people
    // living in it stopped noticing generations ago.
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'enc-granary-against-a-wall',
        name: 'Granary Built Against an Older Wall',
        kind: 'ruin',
        simEventKind: 'opportunity',
        weight: 70,
        minOrdinal: 0,
        maxOrdinal: 8,
        interrupts: false,
        threatOrdinal: null,
        summaryTemplate:
            'The granary at {place} is built against a wall it did not make. {count} fragments have been prised out of the stonework this season and sold by weight at {stones} spirit stones the load.',
        tokens: ['place', 'count', 'stones'],
        tags: ['ruin', 'ordinary', 'trade', 'safe']
    },
    {
        id: 'enc-ploughed-fragments',
        name: 'Fragments Turned Up by the Plough',
        kind: 'ruin',
        simEventKind: 'opportunity',
        weight: 65,
        minOrdinal: 0,
        maxOrdinal: 12,
        interrupts: false,
        threatOrdinal: null,
        summaryTemplate:
            'A farmer at {place} has turned up {count} spirit-tool fragments while ploughing. The qi is long out of them. Asking price for the lot: {stones} spirit stones.',
        tokens: ['place', 'count', 'stones'],
        tags: ['ruin', 'ordinary', 'trade', 'safe']
    },
    {
        id: 'enc-child-toy-spirit-tool',
        name: 'A Child\'s Toy',
        kind: 'ruin',
        simEventKind: 'opportunity',
        weight: 40,
        minOrdinal: 0,
        maxOrdinal: 8,
        interrupts: false,
        threatOrdinal: null,
        summaryTemplate:
            'A child at {place} is using a spirit tool as a toy. Original grade: {grade}. The qi went out of it long ago. Nobody in the village considers this worth mentioning.',
        tokens: ['place', 'grade'],
        tags: ['ruin', 'ordinary', 'safe', 'texture']
    },
    {
        id: 'enc-stone-seats-for-two-hundred',
        name: 'Seating for Two Hundred',
        kind: 'ruin',
        simEventKind: 'opportunity',
        weight: 40,
        minOrdinal: 3,
        maxOrdinal: 20,
        interrupts: false,
        threatOrdinal: null,
        summaryTemplate:
            'A courtyard at {place} holds stone seating for {count}. The sect occupying it has {occupants} disciples. Recoverable from under the benches: {loot}.',
        tokens: ['place', 'count', 'occupants', 'loot'],
        tags: ['ruin', 'ordinary', 'loot', 'safe']
    },
    {
        id: 'enc-tomb-doorway-handprints',
        name: 'Doorway With Handprints',
        kind: 'ruin',
        simEventKind: 'opportunity',
        weight: 45,
        minOrdinal: 5,
        maxOrdinal: 22,
        interrupts: true,
        threatOrdinal: null,
        summaryTemplate:
            'A doorway at {place} has handprints burned into the jamb at a height of {height}. The door stands open by {range} fingers. It was opened from the inside.',
        tokens: ['place', 'height', 'range'],
        tags: ['ruin', 'foreshadowing', 'avoidable']
    },
    {
        id: 'enc-tribulation-scar',
        name: 'Tribulation Scar',
        kind: 'ruin',
        simEventKind: 'opportunity',
        weight: 22,
        minOrdinal: 10,
        maxOrdinal: 44,
        interrupts: false,
        threatOrdinal: null,
        summaryTemplate:
            'The ground at {place} is a tribulation scar {range} paces across, {years} years old. The qi here has not come back and will not. The name of who failed is held in the ledgers of {faction}.',
        tokens: ['place', 'range', 'years', 'faction'],
        tags: ['ruin', 'permanently-thin', 'safe', 'texture']
    },

    // ═══════════════════════════════════════════════════════════════════
    // THE LATE AGE: SEALED SITES
    // Qi nothing has drawn on, and the reasons nothing has.
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'enc-sealed-cave-mouth',
        name: 'Sealed Cave Mouth',
        kind: 'ruin',
        simEventKind: 'opportunity',
        weight: 85,
        minOrdinal: 0,
        maxOrdinal: 14,
        interrupts: true,
        threatOrdinal: null,
        summaryTemplate:
            'A sealed cave mouth is exposed at {place}. Seal grade: {sealGrade}. Nothing has drawn on the qi behind it; estimated density on opening {ambient}. The intended opening method is not legible from outside.',
        tokens: ['place', 'sealGrade', 'ambient'],
        tags: ['ruin', 'sealed', 'untouched-qi', 'high-risk']
    },
    {
        id: 'enc-collapsed-sect-compound',
        name: 'Collapsed Sect Compound',
        kind: 'ruin',
        simEventKind: 'opportunity',
        weight: 70,
        minOrdinal: 2,
        maxOrdinal: 20,
        interrupts: true,
        threatOrdinal: null,
        summaryTemplate:
            'A collapsed sect compound at {place}, empty roughly {years} years. {count} of its formation nodes still show current. The outer wall has been quarried by the nearest village for building stone.',
        tokens: ['place', 'years', 'count'],
        tags: ['ruin', 'sealed', 'loot', 'competition']
    },
    {
        id: 'enc-untouched-qi-pocket',
        name: 'Pocket of Untouched Qi',
        kind: 'ruin',
        simEventKind: 'opportunity',
        weight: 60,
        minOrdinal: 0,
        maxOrdinal: 44,
        interrupts: false,
        threatOrdinal: null,
        summaryTemplate:
            'A sealed pocket at {place} holds qi nothing has ever drawn on. Density on opening: {ambient}. It falls to the local ambient level within {days} days of the seal being broken.',
        tokens: ['place', 'ambient', 'days'],
        tags: ['ruin', 'untouched-qi', 'cultivation-rate', 'timed']
    },
    {
        id: 'enc-guardian-formation-running',
        name: 'Guardian Formation Still Running',
        kind: 'ruin',
        simEventKind: 'encounter',
        weight: 50,
        minOrdinal: 6,
        maxOrdinal: 26,
        interrupts: true,
        threatOrdinal: 20,
        summaryTemplate:
            'A guardian formation at {place} has been running since the site was sealed, roughly {years} years. Measured output: {threatRank}. It does not tire, and it does not pursue past the threshold.',
        tokens: ['place', 'years', 'threatRank'],
        tags: ['ruin', 'hostile', 'formation', 'avoidable']
    },
    {
        id: 'enc-formation-locked-door',
        name: 'Formation-Locked Door',
        kind: 'ruin',
        simEventKind: 'opportunity',
        weight: 45,
        minOrdinal: 8,
        maxOrdinal: 28,
        interrupts: true,
        threatOrdinal: null,
        summaryTemplate:
            'A vault door at {place} carries a live formation at {wardOrdinal} that nobody in the region can read. {count} previous attempts are recorded at the site. None succeeded and {failed} of them left remains.',
        tokens: ['place', 'wardOrdinal', 'count', 'failed'],
        tags: ['ruin', 'sealed', 'high-risk', 'competition']
    },
    {
        id: 'enc-seal-opened-wrong',
        name: 'Seal Opened by the Wrong Method',
        kind: 'misfortune',
        simEventKind: 'injury_sustained',
        weight: 30,
        minOrdinal: 8,
        maxOrdinal: 34,
        interrupts: true,
        threatOrdinal: null,
        summaryTemplate:
            'The seal at {place} was opened by {method} rather than the method it was cut for. Backlash sustained: {severity}. The chamber behind it is open, and whatever the seal was rated to hold is now the finder\'s problem.',
        tokens: ['place', 'method', 'severity'],
        tags: ['ruin', 'injury', 'unavoidable']
    },
    {
        id: 'enc-corpse-still-cultivating',
        name: 'Corpse Still Cultivating',
        kind: 'ruin',
        simEventKind: 'encounter',
        weight: 35,
        minOrdinal: 10,
        maxOrdinal: 32,
        interrupts: true,
        threatOrdinal: 24,
        summaryTemplate:
            'A body seated in the inner chamber at {place} is still cultivating - slowly, badly, and for roughly {years} years. Current output: {threatRank}. It has not registered the door being opened.',
        tokens: ['place', 'years', 'threatRank'],
        tags: ['ruin', 'hostile', 'avoidable', 'high-risk']
    },
    {
        id: 'enc-inheritance-trial-dead-sect',
        name: 'Inheritance Trial of a Dead Sect',
        kind: 'ruin',
        simEventKind: 'opportunity',
        weight: 30,
        minOrdinal: 12,
        maxOrdinal: 44,
        interrupts: true,
        threatOrdinal: null,
        summaryTemplate:
            'An inheritance trial at {place} was left by {faction}, which no longer exists. It is calibrated for that sect\'s own disciples at {wardOrdinal} and does not adjust. Reward on completion: {loot}.',
        tokens: ['place', 'faction', 'wardOrdinal', 'loot'],
        tags: ['ruin', 'inheritance', 'technique', 'high-risk', 'once']
    },
    {
        id: 'enc-rival-diggers-at-the-seal',
        name: 'Rival Diggers at the Same Seal',
        kind: 'ruin',
        simEventKind: 'encounter',
        weight: 45,
        minOrdinal: 4,
        maxOrdinal: 30,
        interrupts: true,
        threatOrdinal: 15,
        summaryTemplate:
            '{count} diggers out of {faction} are working the same seal at {place}. Strongest is at {threatRank}. They arrived {days} days earlier and are most of the way through it.',
        tokens: ['count', 'faction', 'place', 'threatRank', 'days'],
        tags: ['ruin', 'competition', 'hostile', 'negotiable']
    },
    {
        id: 'enc-manual-in-a-lost-grade',
        name: 'Manual in a Grade No Longer Taught',
        kind: 'ruin',
        simEventKind: 'opportunity',
        weight: 25,
        minOrdinal: 10,
        maxOrdinal: 44,
        interrupts: true,
        threatOrdinal: null,
        summaryTemplate:
            'A manual recovered at {place} is written at {grade} grade. No living teacher of it is known; the manual is the only instructor available. Condition: {condition}. Intact resale value: {stones} spirit stones.',
        tokens: ['place', 'grade', 'condition', 'stones'],
        tags: ['ruin', 'technique', 'ruin-only', 'high-value']
    },
    {
        id: 'enc-recovered-recipe-fragment',
        name: 'Refining Method on a Wall',
        kind: 'ruin',
        simEventKind: 'opportunity',
        weight: 30,
        minOrdinal: 8,
        maxOrdinal: 34,
        interrupts: false,
        threatOrdinal: null,
        summaryTemplate:
            'A refining hall at {place} carries a full method for {pillName} cut into the wall. {percent} percent of the script is still legible. No living alchemist devised it, and none has reproduced the missing part.',
        tokens: ['place', 'pillName', 'percent'],
        tags: ['ruin', 'recipe', 'ruin-only', 'safe']
    },
    {
        id: 'enc-old-formation-node-relit',
        name: 'A Node That Can Be Relit',
        kind: 'ruin',
        simEventKind: 'opportunity',
        weight: 20,
        minOrdinal: 12,
        maxOrdinal: 34,
        interrupts: false,
        threatOrdinal: null,
        summaryTemplate:
            'A dead formation node at {place} can be relit with {loot}. While it runs, ambient qi inside the compound holds at {ambient}. {count} of the site\'s nodes are already lit; the rest are not understood.',
        tokens: ['place', 'loot', 'ambient', 'count'],
        tags: ['ruin', 'formation', 'cultivation-rate', 'safe']
    },
    {
        id: 'enc-vein-tapped-by-ancients',
        name: 'A Vein Already Tapped',
        kind: 'ruin',
        simEventKind: 'opportunity',
        weight: 18,
        minOrdinal: 16,
        maxOrdinal: 44,
        interrupts: false,
        threatOrdinal: null,
        summaryTemplate:
            'The vein under {place} was tapped, worked and abandoned {years} years ago. Residual output: {ambient}. The original tap-head is intact and nobody now present can operate it.',
        tokens: ['place', 'years', 'ambient'],
        tags: ['ruin', 'spirit-vein', 'cultivation-rate', 'safe']
    },
    {
        id: 'enc-sealed-hall-of-a-dead-age',
        name: 'Sealed Hall of a Dead Age',
        kind: 'ruin',
        simEventKind: 'opportunity',
        weight: 30,
        minOrdinal: 30,
        maxOrdinal: 44,
        interrupts: true,
        threatOrdinal: null,
        summaryTemplate:
            'A hall at {place} has been sealed since before the current records begin. The seal is rated at {wardOrdinal} and is intact. Nothing has drawn on the qi inside; density {ambient}. The last party to reach the door left {years} years ago without opening it.',
        tokens: ['place', 'wardOrdinal', 'ambient', 'years'],
        tags: ['ruin', 'sealed', 'untouched-qi', 'ruin-only', 'high-risk']
    },
    {
        id: 'enc-spirit-tide',
        name: 'Spirit Tide',
        kind: 'opportunity',
        simEventKind: 'opportunity',
        weight: 8,
        minOrdinal: 0,
        maxOrdinal: 44,
        interrupts: true,
        threatOrdinal: null,
        summaryTemplate:
            'A surge is running under {place} and will hold {days} days: a vein shifting, or a seal that has failed somewhere upstream. Ambient state during the surge: {ambient}. {count} sects have mobilised to hold ground over it, and two of them have a prior claim.',
        tokens: ['place', 'days', 'ambient', 'count'],
        tags: ['opportunity', 'cultivation-rate', 'timed', 'competition']
    },

    // ═══════════════════════════════════════════════════════════════════
    // THE LATE AGE: GRAVES AND GRAVE-READERS
    // A grave is not a burial. Cultivators carry everything they own,
    // most of them die somewhere remote, and all of it stays where they
    // fell. A grave is indifferent and therefore kills more people than
    // an inheritance does: nothing on a corpse is calibrated to whoever
    // finds it. And sects keep records of where their people died.
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'enc-grave-recent-death',
        name: 'Somebody Died Here',
        kind: 'grave',
        simEventKind: 'opportunity',
        weight: 55,
        minOrdinal: 0,
        maxOrdinal: 16,
        interrupts: false,
        threatOrdinal: null,
        summaryTemplate:
            'A cultivator who died at {threatRank} is lying at {place}, roughly {days} days dead, with everything they were carrying still on them: {loot}. Nothing here was arranged for a finder.',
        tokens: ['threatRank', 'place', 'days', 'loot'],
        tags: ['grave', 'loot', 'attention', 'safe']
    },
    {
        id: 'enc-grave-remote-and-old',
        name: 'Remains, Well Off the Road',
        kind: 'grave',
        simEventKind: 'opportunity',
        weight: 35,
        minOrdinal: 14,
        maxOrdinal: 34,
        interrupts: true,
        threatOrdinal: null,
        summaryTemplate:
            'Remains at {place}, dead approximately {years} years, at {threatRank} in life. Recovered from the body: a manual they were part-way through, {loot}, and pills they were saving for a crossing they never attempted. Whatever has grown up around the site since is still here.',
        tokens: ['place', 'years', 'threatRank', 'loot'],
        tags: ['grave', 'technique', 'loot', 'attention', 'high-value']
    },
    {
        id: 'enc-grave-of-a-transcender',
        name: 'Remains of Somebody Far Above',
        kind: 'grave',
        simEventKind: 'opportunity',
        weight: 6,
        minOrdinal: 18,
        maxOrdinal: 44,
        interrupts: true,
        threatOrdinal: null,
        summaryTemplate:
            'The body at {place} was a cultivator at {threatRank}, {gap} ranks above the finder. What they were carrying is usable and is not survivable at this realm. Estimated value: {stones} spirit stones. It was not left for anyone.',
        tokens: ['place', 'threatRank', 'gap', 'stones'],
        tags: ['grave', 'technique', 'high-value', 'lethal', 'once']
    },
    {
        id: 'enc-grave-reader-partnership',
        name: 'Grave-Reader Offers a Partnership',
        kind: 'grave',
        simEventKind: 'npc_event',
        weight: 30,
        minOrdinal: 2,
        maxOrdinal: 26,
        interrupts: true,
        threatOrdinal: null,
        summaryTemplate:
            'A grave-reader working out of {place} proposes terms: their reading of where people fell, the other party\'s digging, {percent} percent of what comes up. They have worked {count} sites and can tell a grave from an inheritance on sight.',
        tokens: ['place', 'percent', 'count'],
        tags: ['grave', 'social', 'quest', 'avoidable']
    },
    {
        id: 'enc-attention-from-a-robbed-grave',
        name: 'Attention From a Robbed Grave',
        kind: 'grave',
        simEventKind: 'encounter',
        weight: 20,
        minOrdinal: 6,
        maxOrdinal: 36,
        interrupts: true,
        threatOrdinal: 22,
        summaryTemplate:
            'The body stripped at {place} was one of theirs, and {faction} keeps records of where its people fell. {count} sent to recover the goods, strongest at {threatRank}. They have not opened with a request for their return.',
        tokens: ['place', 'faction', 'count', 'threatRank'],
        tags: ['grave', 'hostile', 'feud-seed', 'unavoidable']
    },

    // ═══════════════════════════════════════════════════════════════════
    // QI IS A CONTESTED RESOURCE
    // A region supports only so many cultivators, and qi drawn by one is
    // not available to another. Everyone can do the arithmetic. Nobody
    // defends the conclusion out loud, and the practice has never quite
    // been stamped out.
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'enc-valley-overdrawn',
        name: 'Too Many Drawing on One Valley',
        kind: 'misfortune',
        simEventKind: 'resource_depleted',
        weight: 45,
        minOrdinal: 0,
        maxOrdinal: 24,
        interrupts: false,
        threatOrdinal: null,
        summaryTemplate:
            '{place} comfortably carries {supported} cultivators and currently holds {count}. Measured ambient has fallen to {ambient} and progress here is running at {percent} percent of the rate it was two years ago. Nobody has said anything.',
        tokens: ['place', 'supported', 'count', 'ambient', 'percent'],
        tags: ['contested-qi', 'cultivation-rate', 'relocate', 'safe']
    },
    {
        id: 'enc-thin-region-ceiling',
        name: 'A Region With a Ceiling',
        kind: 'misfortune',
        simEventKind: 'resource_depleted',
        weight: 35,
        minOrdinal: 0,
        maxOrdinal: 12,
        interrupts: false,
        threatOrdinal: null,
        summaryTemplate:
            'Ambient qi across {place} is {ambient} and has been for as long as anyone has measured. Nobody local has passed Qi Condensation in {years} years. Cultivating here does not advance; it holds. The nearest ground that will support advancement is {days} days away and owned.',
        tokens: ['place', 'ambient', 'years', 'days'],
        tags: ['contested-qi', 'ceiling', 'relocate', 'ordinary']
    },
    {
        id: 'enc-vein-claim-dispute',
        name: 'Two Claims on One Vein',
        kind: 'sect_event',
        simEventKind: 'sect_event',
        weight: 30,
        minOrdinal: 8,
        maxOrdinal: 34,
        interrupts: true,
        threatOrdinal: 24,
        summaryTemplate:
            '{faction} and {rivalFaction} both hold a claim on the vein under {place}, dated {years} years apart and both documented. Field strength on the ground peaks at {threatRank}. Whoever holds it in a year will still be producing cultivators in fifty.',
        tokens: ['faction', 'rivalFaction', 'place', 'years', 'threatRank'],
        tags: ['contested-qi', 'sect', 'war', 'territory']
    },
    {
        id: 'enc-vein-lost',
        name: 'A Sect That Lost Its Vein',
        kind: 'sect_event',
        simEventKind: 'sect_event',
        weight: 25,
        minOrdinal: 6,
        maxOrdinal: 36,
        interrupts: false,
        threatOrdinal: null,
        summaryTemplate:
            '{faction} lost the vein under {place} to {rivalFaction} {years} years ago. Its intake has produced {count} cultivators past Foundation Establishment since. It is selling its library, and the terms are better than they should be.',
        tokens: ['faction', 'place', 'rivalFaction', 'years', 'count'],
        tags: ['contested-qi', 'sect', 'decline', 'trade', 'technique']
    },
    {
        id: 'enc-cull-for-qi',
        name: 'The Arithmetic, Acted On',
        kind: 'misfortune',
        simEventKind: 'encounter',
        weight: 18,
        minOrdinal: 4,
        maxOrdinal: 30,
        interrupts: true,
        threatOrdinal: 20,
        summaryTemplate:
            'The outer disciples of {faction} at {place} were killed over {days} days, {count} of them, by parties at {threatRank}. Measured ambient in the valley has risen from {ambient} since. No sect has claimed it and three have moved cultivators in.',
        tokens: ['faction', 'place', 'days', 'count', 'threatRank', 'ambient'],
        tags: ['contested-qi', 'hostile', 'atrocity', 'reputation', 'feud-seed']
    },

    // ═══════════════════════════════════════════════════════════════════
    // DAO HOUSES
    // The obstacle here is civil authority, not combat strength. Every one
    // of these can be solved by killing somebody, and the summary is
    // written so that the engine's real question is what happens
    // afterwards. `threatOrdinal` is null on most of them on purpose: the
    // party standing in the way is not the threat.
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'enc-ledger-audit-notice',
        name: 'Audit Notice',
        kind: 'dao_house',
        simEventKind: 'npc_event',
        weight: 40,
        minOrdinal: 2,
        maxOrdinal: 30,
        interrupts: true,
        threatOrdinal: null,
        summaryTemplate:
            'An auditor of {faction} serves notice at {place} of an obligation {generations} generations old, inherited and unsettled. Assessed at {stones} spirit stones or an equivalent service. The auditor is at {threatRank} and travels alone.',
        tokens: ['faction', 'place', 'generations', 'stones', 'threatRank'],
        tags: ['dao-house', 'civil', 'karma', 'negotiable', 'afterwards']
    },
    {
        id: 'enc-oath-witness-required',
        name: 'Witness Required',
        kind: 'dao_house',
        simEventKind: 'npc_event',
        weight: 45,
        minOrdinal: 3,
        maxOrdinal: 32,
        interrupts: false,
        threatOrdinal: null,
        summaryTemplate:
            'The agreement at {place} will not be recognised by any party to it without a witness of {faction}. Fee: {stones} spirit stones. Penalty clause on breach as written: {penalty}. Unwitnessed, the agreement binds nobody and both sides know it.',
        tokens: ['place', 'faction', 'stones', 'penalty'],
        tags: ['dao-house', 'civil', 'oaths', 'trade', 'safe']
    },
    {
        id: 'enc-narrow-hour-summons',
        name: 'Named in a Convergence',
        kind: 'dao_house',
        simEventKind: 'npc_event',
        weight: 25,
        minOrdinal: 6,
        maxOrdinal: 36,
        interrupts: true,
        threatOrdinal: null,
        summaryTemplate:
            'An adviser of {faction} states at {place} that the cultivator appears in a convergence the house is managing, due in {days} days. The house will say which convergence for {stones} spirit stones. It has not said what the cultivator does in it.',
        tokens: ['faction', 'place', 'days', 'stones'],
        tags: ['dao-house', 'civil', 'fate', 'timed', 'avoidable']
    },
    {
        id: 'enc-held-names-registration',
        name: 'Registration at the Gate',
        kind: 'dao_house',
        simEventKind: 'npc_event',
        weight: 50,
        minOrdinal: 0,
        maxOrdinal: 24,
        interrupts: true,
        threatOrdinal: null,
        summaryTemplate:
            'The gate at {place} admits nobody unregistered. {faction} takes the name, holds it, and charges {stones} spirit stones a year. Unregistered parties may not trade, testify, inherit or be buried inside the walls.',
        tokens: ['place', 'faction', 'stones'],
        tags: ['dao-house', 'civil', 'names', 'ordinary', 'avoidable']
    },
    {
        id: 'enc-quiet-cut-offer',
        name: 'An Offer to Cut',
        kind: 'dao_house',
        simEventKind: 'npc_event',
        weight: 20,
        minOrdinal: 7,
        maxOrdinal: 38,
        interrupts: true,
        threatOrdinal: null,
        summaryTemplate:
            'A third party at {place} conveys an offer from {faction}: one connection removed, permanently, for {stones} spirit stones. The connection named in the offer is {target}. Removal cannot be reversed by them or by anyone.',
        tokens: ['place', 'faction', 'stones', 'target'],
        tags: ['dao-house', 'severance', 'irreversible', 'avoidable', 'afterwards']
    },
    {
        id: 'enc-anchorhold-perimeter-refusal',
        name: 'Perimeter Refusal',
        kind: 'dao_house',
        simEventKind: 'npc_event',
        weight: 30,
        minOrdinal: 8,
        maxOrdinal: 40,
        interrupts: true,
        threatOrdinal: null,
        summaryTemplate:
            'A warden of {faction} refuses passage into the perimeter at {place}, which has been maintained {years} years. Behind it: {contained}. The warden is at {threatRank} and is not authorised to negotiate.',
        tokens: ['faction', 'place', 'years', 'contained', 'threatRank'],
        tags: ['dao-house', 'civil', 'fixity', 'forbidden-zone', 'afterwards']
    },
    {
        id: 'enc-span-station-closed',
        name: 'Station Closed to the Cultivator',
        kind: 'dao_house',
        simEventKind: 'npc_event',
        weight: 28,
        minOrdinal: 4,
        maxOrdinal: 34,
        interrupts: false,
        threatOrdinal: null,
        summaryTemplate:
            'The station at {place} will not carry the cultivator. {faction} gives the reason as {reason}. The walked distance to the destination is {days} days; the span is one hour, and every other route out is also theirs.',
        tokens: ['place', 'faction', 'reason', 'days'],
        tags: ['dao-house', 'civil', 'space', 'logistics', 'safe']
    },
    {
        id: 'enc-ancestral-claim-verification',
        name: 'A Claim Nobody Has Checked',
        kind: 'dao_house',
        simEventKind: 'npc_event',
        weight: 22,
        minOrdinal: 5,
        maxOrdinal: 38,
        interrupts: true,
        threatOrdinal: null,
        summaryTemplate:
            '{faction} has claimed a living ancestor above the ceiling for {years} years, and its standing rests on it. {rivalFaction} will certify or refuse the claim for {stones} spirit stones and has refused {count} such claims before. The certification is public whichever way it goes.',
        tokens: ['faction', 'years', 'rivalFaction', 'stones', 'count'],
        tags: ['dao-house', 'civil', 'ancestry', 'reputation', 'afterwards']
    },
    {
        id: 'enc-house-member-killed',
        name: 'What Happens Afterwards',
        kind: 'dao_house',
        simEventKind: 'npc_event',
        weight: 18,
        minOrdinal: 6,
        maxOrdinal: 40,
        interrupts: true,
        threatOrdinal: null,
        summaryTemplate:
            'A member of {faction} died at {place} {days} days ago, and the house has established who. It has sent nobody. What it has done instead: {consequence}. Parties who have withdrawn service since: {count}.',
        tokens: ['faction', 'place', 'days', 'consequence', 'count'],
        tags: ['dao-house', 'civil', 'afterwards', 'unavoidable', 'feud-seed']
    },

    // ═══════════════════════════════════════════════════════════════════
    // COMMERCE
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'enc-market-day',
        name: 'Market Day',
        kind: 'commerce',
        simEventKind: 'opportunity',
        weight: 70,
        minOrdinal: 0,
        maxOrdinal: 20,
        interrupts: false,
        threatOrdinal: null,
        summaryTemplate:
            'Market day at {place}. Stock available: {loot}. Grain and lodging are priced at {stones} spirit stones for the stay.',
        tokens: ['place', 'loot', 'stones'],
        tags: ['trade', 'food', 'safe']
    },
    {
        id: 'enc-travelling-pill-merchant',
        name: 'Travelling Pill Merchant',
        kind: 'commerce',
        simEventKind: 'opportunity',
        weight: 45,
        minOrdinal: 0,
        maxOrdinal: 26,
        interrupts: false,
        threatOrdinal: null,
        summaryTemplate:
            'A pill merchant is camped at {place} for {days} days, carrying {loot}. Asking price is {percent} percent above standing market rate.',
        tokens: ['place', 'days', 'loot', 'percent'],
        tags: ['trade', 'pills', 'timed', 'safe']
    },
    {
        id: 'enc-city-auction',
        name: 'City Auction',
        kind: 'commerce',
        simEventKind: 'opportunity',
        weight: 25,
        minOrdinal: 6,
        maxOrdinal: 34,
        interrupts: false,
        threatOrdinal: null,
        summaryTemplate:
            'An auction is held at {place} by {faction} in {days} days. Catalogued lots include {loot}. Entry bond: {stones} spirit stones.',
        tokens: ['place', 'faction', 'days', 'loot', 'stones'],
        tags: ['trade', 'auction', 'timed', 'social']
    },
    {
        id: 'enc-grand-auction',
        name: 'Grand Auction',
        kind: 'commerce',
        simEventKind: 'opportunity',
        weight: 8,
        minOrdinal: 18,
        maxOrdinal: 40,
        interrupts: true,
        threatOrdinal: null,
        summaryTemplate:
            '{faction} announces a grand auction at {place} in {days} days. Headline lot: {loot}, reserve {stones} spirit stones. {count} sects have confirmed attendance.',
        tokens: ['faction', 'place', 'days', 'loot', 'stones', 'count'],
        tags: ['trade', 'auction', 'timed', 'competition', 'high-value']
    },
    {
        id: 'enc-alchemist-commission',
        name: 'Alchemist Seeking Ingredients',
        kind: 'commerce',
        simEventKind: 'opportunity',
        weight: 30,
        minOrdinal: 4,
        maxOrdinal: 28,
        interrupts: false,
        threatOrdinal: null,
        summaryTemplate:
            'An alchemist of {faction} at {place} commissions {count} of {herbName}, payment {stones} spirit stones on delivery within {days} days.',
        tokens: ['faction', 'place', 'count', 'herbName', 'stones', 'days'],
        tags: ['quest', 'herb', 'timed', 'safe']
    },

    // ═══════════════════════════════════════════════════════════════════
    // SECT EVENTS
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'enc-sect-recruitment-drive',
        name: 'Sect Recruitment Drive',
        kind: 'sect_event',
        simEventKind: 'sect_event',
        weight: 55,
        minOrdinal: 0,
        maxOrdinal: 12,
        interrupts: false,
        threatOrdinal: null,
        summaryTemplate:
            '{faction} is holding open recruitment at {place} for {days} days. Admission requirement: {requirement}. Outer-rank stipend: {stones} spirit stones monthly.',
        tokens: ['faction', 'place', 'days', 'requirement', 'stones'],
        tags: ['sect', 'joinable', 'timed', 'safe']
    },
    {
        id: 'enc-sect-mission-board',
        name: 'Sect Mission Board',
        kind: 'sect_event',
        simEventKind: 'sect_event',
        weight: 50,
        minOrdinal: 3,
        maxOrdinal: 24,
        interrupts: false,
        threatOrdinal: null,
        summaryTemplate:
            'The mission board at {faction} lists {count} open commissions. Best available for this realm: {task}, paying {stones} spirit stones, expected threat {threatRank}.',
        tokens: ['faction', 'count', 'task', 'stones', 'threatRank'],
        tags: ['sect', 'quest', 'safe']
    },
    {
        id: 'enc-inner-sect-tournament',
        name: 'Inner Sect Tournament',
        kind: 'sect_event',
        simEventKind: 'sect_event',
        weight: 25,
        minOrdinal: 8,
        maxOrdinal: 26,
        interrupts: true,
        threatOrdinal: 16,
        summaryTemplate:
            '{faction} holds its ranking tournament at {place} in {days} days. {count} entrants confirmed, strongest at {threatRank}. Prize for first place: {loot}.',
        tokens: ['faction', 'place', 'days', 'count', 'threatRank', 'loot'],
        tags: ['sect', 'competition', 'non-lethal', 'reputation', 'technique']
    },
    {
        id: 'enc-sect-war-mobilization',
        name: 'Sect War Mobilisation',
        kind: 'sect_event',
        simEventKind: 'sect_event',
        weight: 12,
        minOrdinal: 14,
        maxOrdinal: 36,
        interrupts: true,
        threatOrdinal: 24,
        summaryTemplate:
            '{faction} mobilises against {rivalFaction} over {cause}. All ranked members are recalled within {days} days. Enemy field strength peaks at {threatRank}.',
        tokens: ['faction', 'rivalFaction', 'cause', 'days', 'threatRank'],
        tags: ['sect', 'war', 'obligation', 'high-risk']
    },
    {
        id: 'enc-elder-seeking-successor',
        name: 'Elder Seeking a Successor',
        kind: 'sect_event',
        simEventKind: 'sect_event',
        weight: 8,
        minOrdinal: 10,
        maxOrdinal: 30,
        interrupts: true,
        threatOrdinal: null,
        summaryTemplate:
            'An elder of {faction} at {wardOrdinal} is choosing a successor at {place} and has {years} years of lifespan remaining. Offered on acceptance: {loot}. Candidates considered: {count}.',
        tokens: ['faction', 'wardOrdinal', 'place', 'years', 'loot', 'count'],
        tags: ['sect', 'technique', 'social', 'once']
    },

    // ═══════════════════════════════════════════════════════════════════
    // MISFORTUNES
    // The genre's thesis, expressed as a weight table.
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'enc-qi-deviation-onset',
        name: 'Qi Deviation Onset',
        kind: 'misfortune',
        simEventKind: 'qi_deviation',
        weight: 30,
        minOrdinal: 0,
        maxOrdinal: 44,
        interrupts: true,
        threatOrdinal: null,
        summaryTemplate:
            'Circulating qi reverses during cultivation on day {days}. Severity: {severity}. Cause: {cause}. Cultivation is halted until the deviation is cleansed.',
        tokens: ['days', 'severity', 'cause'],
        tags: ['injury', 'unavoidable', 'pill-solvable']
    },
    {
        id: 'enc-heart-demon-whisper',
        name: 'Heart Demon',
        kind: 'misfortune',
        simEventKind: 'qi_deviation',
        weight: 16,
        minOrdinal: 13,
        maxOrdinal: 40,
        interrupts: true,
        threatOrdinal: null,
        summaryTemplate:
            'A heart demon surfaces in seclusion on day {days}, keyed to {cause}. Breakthrough odds are reduced by {percent} percent until it is resolved.',
        tokens: ['days', 'cause', 'percent'],
        tags: ['deviation', 'breakthrough-penalty', 'unavoidable']
    },
    {
        id: 'enc-spirit-storm',
        name: 'Spirit Storm',
        kind: 'misfortune',
        simEventKind: 'encounter',
        weight: 20,
        minOrdinal: 5,
        maxOrdinal: 30,
        interrupts: true,
        threatOrdinal: null,
        summaryTemplate:
            'A spirit storm crosses {place} and lasts {days} days. Ambient qi during the storm: {ambient}. Cultivating in the open during it carries deviation risk of {percent} percent.',
        tokens: ['place', 'days', 'ambient', 'percent'],
        tags: ['weather', 'deviation-risk', 'cultivation-rate']
    },
    {
        id: 'enc-plague-village',
        name: 'Plague in a Village',
        kind: 'misfortune',
        simEventKind: 'npc_event',
        weight: 18,
        minOrdinal: 0,
        maxOrdinal: 18,
        interrupts: true,
        threatOrdinal: null,
        summaryTemplate:
            'A plague has taken hold at {place}; {count} dead so far. A healing art or {loot} would stop it. {faction} has not sent anyone.',
        tokens: ['place', 'count', 'loot', 'faction'],
        tags: ['social', 'reputation', 'support', 'avoidable']
    },
    {
        id: 'enc-robbed-in-seclusion',
        name: 'Robbed During Seclusion',
        kind: 'misfortune',
        simEventKind: 'resource_depleted',
        weight: 22,
        minOrdinal: 0,
        maxOrdinal: 24,
        interrupts: false,
        threatOrdinal: 7,
        summaryTemplate:
            'The cave at {place} was entered on day {days} while the cultivator was in seclusion. Taken: {stones} spirit stones and {loot}. The intruder was at {threatRank} and did not attempt the inner chamber.',
        tokens: ['place', 'days', 'stones', 'loot', 'threatRank'],
        tags: ['loss', 'unavoidable', 'feud-seed']
    },
    {
        id: 'enc-thin-qi-stagnation',
        name: 'Thin Qi Stagnation',
        kind: 'misfortune',
        simEventKind: 'lifespan_warning',
        weight: 10,
        minOrdinal: 20,
        maxOrdinal: 44,
        interrupts: false,
        threatOrdinal: null,
        summaryTemplate:
            'Ambient qi at {place} has fallen to {ambient}. Cultivation over the last {years} years produced no measurable progress. Remaining lifespan at this realm: {remainingYears} years.',
        tokens: ['place', 'ambient', 'years', 'remainingYears'],
        tags: ['stagnation', 'lifespan', 'relocate']
    },
    {
        id: 'enc-sect-betrayal',
        name: 'Sect Betrayal',
        kind: 'misfortune',
        simEventKind: 'sect_event',
        weight: 8,
        minOrdinal: 10,
        maxOrdinal: 38,
        interrupts: true,
        threatOrdinal: 22,
        summaryTemplate:
            '{name} of {faction} has laid a charge of {cause} and the sect has ruled against the accused. Stipend suspended, {loot} confiscated, and enforcers at {threatRank} dispatched.',
        tokens: ['name', 'faction', 'cause', 'loot', 'threatRank'],
        tags: ['sect', 'betrayal', 'feud-seed', 'high-risk']
    },
    {
        id: 'enc-early-tribulation-cloud',
        name: 'Early Tribulation Cloud',
        kind: 'misfortune',
        simEventKind: 'encounter',
        weight: 6,
        minOrdinal: 37,
        maxOrdinal: 44,
        interrupts: true,
        threatOrdinal: null,
        summaryTemplate:
            'A tribulation cloud gathers over {place} {days} days before the attempt was planned. Estimated strikes: {count}. Current injuries untreated: {untreated}.',
        tokens: ['place', 'days', 'count', 'untreated'],
        tags: ['tribulation', 'unavoidable', 'lethal']
    }
] as const;

// ─────────────────────────────────────────────────────────────────────────
// INDICES + LOOKUPS
// ─────────────────────────────────────────────────────────────────────────

const ENCOUNTER_BY_ID: ReadonlyMap<string, EncounterEntry> = new Map(ENCOUNTERS.map(e => [e.id, e]));

const ENCOUNTERS_BY_KIND: ReadonlyMap<EncounterKind, readonly EncounterEntry[]> = (() => {
    const map = new Map<EncounterKind, EncounterEntry[]>();
    for (const e of ENCOUNTERS) {
        const bucket = map.get(e.kind);
        if (bucket) bucket.push(e);
        else map.set(e.kind, [e]);
    }
    return map;
})();

/**
 * Eligible entries per ordinal, precomputed for all 45 ranks. The time-skip
 * simulation may draw thousands of times in one call, so the per-draw cost is
 * a weighted walk over an already-filtered list rather than a scan of the
 * catalog.
 */
const ENCOUNTERS_BY_ORDINAL: readonly (readonly EncounterEntry[])[] = (() => {
    const buckets: EncounterEntry[][] = Array.from({ length: TOTAL_RANKS }, () => []);
    for (const e of ENCOUNTERS) {
        for (let o = e.minOrdinal; o <= e.maxOrdinal; o++) buckets[o].push(e);
    }
    return buckets;
})();

const TOTAL_WEIGHT_BY_ORDINAL: readonly number[] =
    ENCOUNTERS_BY_ORDINAL.map(bucket => bucket.reduce((sum, e) => sum + e.weight, 0));

export function getEncounter(id: string): EncounterEntry | undefined {
    return ENCOUNTER_BY_ID.get(id);
}

export function requireEncounter(id: string): EncounterEntry {
    const e = ENCOUNTER_BY_ID.get(id);
    if (!e) throw new Error(`Unknown encounter: ${id}`);
    return e;
}

export function getEncountersByKind(kind: EncounterKind): readonly EncounterEntry[] {
    return ENCOUNTERS_BY_KIND.get(kind) ?? [];
}

/** Everything that may fire at this ordinal, unfiltered. */
export function getEncountersForOrdinal(ordinal: number): readonly EncounterEntry[] {
    return ENCOUNTERS_BY_ORDINAL[clampOrdinal(ordinal)];
}

export interface EncounterQuery {
    kind?: EncounterKind;
    /** Restrict to entries that stop the skip, or to entries that do not. */
    interrupts?: boolean;
    /** Restrict to entries whose threat is at most this many ranks above. */
    maxThreatGap?: number;
}

/**
 * Weighted draw from a uniform [0,1) sample. The caller owns seeding, matching
 * `rollSpiritRoot` and `rollHerb`, so a run replays identically from its seed.
 * Returns undefined only when a filter excludes everything.
 */
export function rollEncounter(
    ordinal: number,
    sample: number,
    opts: EncounterQuery = {}
): EncounterEntry | undefined {
    const o = clampOrdinal(ordinal);
    const unfiltered = ENCOUNTERS_BY_ORDINAL[o];
    const filtered = hasFilters(opts)
        ? unfiltered.filter(e => matches(e, o, opts))
        : unfiltered;
    if (filtered.length === 0) return undefined;

    const total = hasFilters(opts)
        ? filtered.reduce((sum, e) => sum + e.weight, 0)
        : TOTAL_WEIGHT_BY_ORDINAL[o];
    let cursor = Math.max(0, Math.min(0.999999999, sample)) * total;
    for (const e of filtered) {
        cursor -= e.weight;
        if (cursor < 0) return e;
    }
    return filtered[filtered.length - 1];
}

function hasFilters(opts: EncounterQuery): boolean {
    return opts.kind !== undefined || opts.interrupts !== undefined || opts.maxThreatGap !== undefined;
}

function matches(e: EncounterEntry, ordinal: number, opts: EncounterQuery): boolean {
    if (opts.kind && e.kind !== opts.kind) return false;
    if (opts.interrupts !== undefined && e.interrupts !== opts.interrupts) return false;
    if (opts.maxThreatGap !== undefined && e.threatOrdinal !== null) {
        if (e.threatOrdinal - ordinal > opts.maxThreatGap) return false;
    }
    return true;
}

function clampOrdinal(ordinal: number): number {
    if (!Number.isFinite(ordinal)) return 0;
    return Math.max(0, Math.min(MAX_ORDINAL, Math.floor(ordinal)));
}

/**
 * Fill a `summaryTemplate` from a token map. Unknown tokens are left in place
 * rather than blanked, so a missing fact is loud in the log instead of quietly
 * becoming an empty string the agent then narrates around.
 */
export function fillSummary(entry: EncounterEntry, values: Record<string, string | number>): string {
    return entry.summaryTemplate.replace(/\{(\w+)\}/gu, (whole, token: string) => {
        const value = values[token];
        return value === undefined ? whole : String(value);
    });
}

/** Tokens the engine still has to supply for this entry. */
export function missingTokens(entry: EncounterEntry, values: Record<string, unknown>): string[] {
    return entry.tokens.filter(t => values[t] === undefined);
}

/**
 * Share of the eligible draw weight at this ordinal that is ruins or graves.
 * Exploration is the core loop for a cultivator without talent, so this stays
 * substantial across the whole ladder rather than tapering into a late-game
 * garnish. Returned as a fraction of 1.
 */
export function ruinWeightShare(ordinal: number): number {
    const o = clampOrdinal(ordinal);
    const pool = ENCOUNTERS_BY_ORDINAL[o];
    const total = TOTAL_WEIGHT_BY_ORDINAL[o];
    if (total === 0) return 0;
    const dig = pool
        .filter(e => e.kind === 'ruin' || e.kind === 'grave')
        .reduce((sum, e) => sum + e.weight, 0);
    return dig / total;
}

/** Every SimEvent kind this table can emit. Useful for engine exhaustiveness. */
export function encounterSimEventKinds(): SimEventKind[] {
    return [...new Set(ENCOUNTERS.map(e => e.simEventKind))];
}
