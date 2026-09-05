/**
 * The wound table - every way a person in this world can be hurt, as data.
 */

import { z } from 'zod';
import type { InjurySeverity } from '../../schema/cultivation.js';

// ─────────────────────────────────────────────────────────────────────────
// THE CONTRACT
// ─────────────────────────────────────────────────────────────────────────

/**
 * Physical or mental, and nothing else.
 */
export const WoundNatureSchema = z.enum(['physical', 'mental']);
export type WoundNature = z.infer<typeof WoundNatureSchema>;

export const WoundTypeSchema = z.object({
    /** Stable key. This is what a persisted wound row stores. */
    key: z.string().min(3),
    nature: WoundNatureSchema,
    /** Short factual name. The narrator renders it; it does not rewrite it. */
    name: z.string().min(3),
    /**
     * What the wound actually is, factually. Engine-authored, narrator-rendered
     * - the same contract `defaultInjuryDescription` has always had, moved
     * somewhere it can be authored properly instead of composed from two enums.
     */
    description: z.string().min(60),
    /**
     * Severities this wound can legitimately be sustained at. A maiming is
     * never minor; a scorched channel is never crippling on its own.
     */
    severities: z.array(z.enum(['minor', 'serious', 'crippling'])).min(1),
    /**
     * True where nothing in the world closes it. Such a wound stays untreated
     * for life, keeps costing, and is excluded from the bleed-out clock.
     */
    permanent: z.boolean(),
    /**
     * What would answer it. Says so plainly where the answer is "nothing",
     * which for several of these is the honest and load-bearing answer.
     */
    treatment: z.string().min(40),
    /**
     * What somebody who has this is LIKE to meet.
     */
    presentation: z.string().min(80)
});
export type WoundType = z.infer<typeof WoundTypeSchema>;

// ─────────────────────────────────────────────────────────────────────────
// THE TABLE
//
// Ordered loosely by how far up the ladder they start appearing, which is a
// reading convenience and nothing more - no consumer depends on the order.
// ─────────────────────────────────────────────────────────────────────────

export const WOUND_TYPES: readonly WoundType[] = [
    // ── Physical, ordinary. What the engine has always produced. ──
    {
        key: 'torn-meridians',
        nature: 'physical',
        name: 'Torn meridians',
        description:
            'A channel that carries qi has been opened along its length. It does not close on its own, and every day it stays open is a day the qi moving through it makes it slightly worse.',
        severities: ['minor', 'serious', 'crippling'],
        permanent: false,
        treatment:
            'A meridian-knitting pill, a physician who works in qi, or a long enough seclusion spent circulating around the tear rather than through it.',
        presentation:
            'Someone favouring one side, slow to draw on their own qi, and reluctant to be pressed into anything sudden. Nothing visible until they have to move fast.'
    },
    {
        key: 'scorched-channels',
        nature: 'physical',
        name: 'Scorched channels',
        description:
            'Qi was forced through faster than the channel could pass it and the walls have been burned rather than torn. It carries, and it carries less than it did.',
        severities: ['minor', 'serious'],
        permanent: false,
        treatment: 'Cooling decoctions and months of deliberately under-drawing. Slow, cheap, and reliable.',
        presentation:
            'A cultivator who has visibly overreached recently and is being careful about it, usually while insisting they are fine.'
    },

    // ── Physical, permanent. The maiming band. ──
    {
        key: 'severed-meridian',
        nature: 'physical',
        name: 'A severed meridian',
        description:
            'A channel was not torn but parted, and the two ends have healed closed rather than back together. The route is gone. What it fed is fed by nothing now, and no amount of qi finds its way there again.',
        severities: ['serious', 'crippling'],
        permanent: true,
        treatment:
            'Nothing. A parted channel is the one meridian injury the pharmacopoeia has never had an answer for, and every physician in the two provinces will say so in the same words.',
        presentation:
            'Somebody strong who cannot do one specific thing any more, is entirely matter-of-fact about which thing, and has rebuilt their whole art around the absence. Frequently more dangerous than they were before, in a narrower way.'
    },
    // 'A ruined dantian' stood here and has been retired. THIS SETTING SAYS
    // CORE, and once the borrowed word goes the row had no subject left: it
    // named a reservoir that was neither a channel nor the cultivation, which
    // is a third family this setting does not have. See the note beside
    // 'Incomplete cultivation' below, which is where its mechanics went, and
    // `docs/world/climbing/injuries.md` for the two families it was sitting between.

    // THE BROKEN STATUSES - one per realm boundary
    {
        key: 'broken-foundation',
        nature: 'physical',
        name: 'A broken foundation',
        description:
            'The foundation set, and set wrong. It carries the weight it is under now and it will not carry the weight of a core, and there is no second pour - the qi that would have gone into it was spent getting this far.',
        severities: ['crippling'],
        permanent: true,
        treatment:
            'A foundation-repairing pill, which exists, is made in perhaps three places, and costs what a small sect is worth. Below that grade, nothing.',
        presentation:
            'A Foundation Establishment cultivator of enormous experience and no prospects, usually forty years into being extremely good at the rung they are on. They teach well. They are asked about Core Formation exactly once by each new disciple.'
    },
    {
        key: 'cracked-core',
        nature: 'physical',
        name: 'A cracked core',
        description:
            'The core formed with a fault running through it. It turns, it holds, and it will not survive being opened to birth anything.',
        severities: ['crippling'],
        permanent: true,
        treatment:
            'A foundation-repairing pill of earth grade or better. The fault is in the structure rather than the channels, so nothing that treats meridians reaches it.',
        presentation:
            'Core Formation, comfortable, established, and entirely without a next step. Frequently the most politically capable people in a sect, because the ones who are still climbing have somewhere else to put the effort.'
    },
    {
        key: 'crippled-nascent-soul',
        nature: 'physical',
        name: 'A crippled nascent soul',
        description:
            'The infant soul was born and did not finish forming. It is not the shape of nothing - it is a real one, crippled: it holds the body together, it cannot survive very long outside it, and it will never separate cleanly, which is the entire point of the realm and the one thing this one cannot do.',
        severities: ['crippling'],
        permanent: true,
        treatment:
            'A foundation-repairing pill of heaven grade or better, and the record of one working is a single line four hundred years old.',
        presentation:
            'Nascent Soul in every way that a stranger could check, and mortal in the way that matters: destroy the body and they are gone. They do not advertise it and a great many of them have died of somebody finding out.'
    },
    {
        key: 'failed-transformation',
        nature: 'physical',
        name: 'A failed transformation',
        description:
            'The form was taken apart and put back together with body and soul lying alongside each other rather than through each other. It works, and it works partly: what the realm confers, this one confers a fraction of. It is two things wearing one shape, and it will not be raised as one.',
        severities: ['crippling'],
        permanent: true,
        treatment:
            'A foundation-repairing pill of heaven grade or better. The immortal grade is the one that reliably works and it cannot be made on this side.',
        presentation:
            'Deity Transformation, and a half-second of hesitation between deciding and moving that nobody below the realm can see and nobody at it can miss. It is the tell, and their peers are unfailingly polite about it.'
    },
    {
        key: 'partial-refinement',
        nature: 'physical',
        name: 'A partial refinement',
        description:
            'Refining the self against emptiness is what the realm is, and this one only went partway. What it built it built imperfectly - the reach a cultivator perceives with extends, returns wrong, and the errors are not the kind the owner can detect from inside. They have some of what the realm gives and not the rest.',
        severities: ['crippling'],
        permanent: true,
        treatment:
            'A foundation-repairing pill of immortal grade. Nothing made below the Lid has ever restored a spirit sense once it has been torn in the emptiness.',
        presentation:
            'Void Refinement, and a reach that reports things which are not there and misses things that are. They compensate by never relying on it - they ask, they send people, they check twice - and it makes them look either extraordinarily careful or extraordinarily suspicious depending on who is describing them.'
    },
    {
        key: 'failed-integration',
        nature: 'physical',
        name: 'A failed integration',
        description:
            'Soul and body were welded from the sinew inward and one seam did not close. The body is not fully integrated and parts of it do not work right. Everything moving through this cultivator is enormous, and there is a place where it is not held.',
        severities: ['crippling'],
        permanent: true,
        treatment:
            'A foundation-repairing pill of immortal grade, sent down. Three are known to have been used in the whole of the dated record and one of them was for this.',
        presentation:
            'Body Integration, indivisible everywhere but one place, and the whole of their art is built around not being touched there. It is how people at this realm are killed, and they are the only ones who know precisely where.'
    },
    {
        key: 'unfulfilled-ascension',
        nature: 'physical',
        name: 'An unfulfilled ascension',
        description:
            'Body, soul, name and dao are raised in that order and the rising stopped partway along. They did not fully ascend. What was raised stays raised. What was not never will be, and the four no longer sit level with each other.',
        severities: ['crippling'],
        permanent: true,
        treatment:
            'A foundation-repairing pill of immortal grade, and it is the last rung anything of the kind reaches. There is no medicine for the crossing above this one.',
        presentation:
            'Grand Ascension, uneven - enormous along the axes that went up and oddly ordinary along the ones that did not. Which is which differs by person and is the single most useful thing to know about any of them.'
    },
    {
        key: 'imperfect-tribulation-body',
        nature: 'physical',
        name: 'An imperfect tribulation body',
        description:
            'The step into the last realm was taken and did not land clean. The body formed, and it formed with flaws that make it significantly worse than a true transcendent\'s. They are at the rung, they hold it, and the part of them that would summon a tribulation is the part that broke getting here.',
        severities: ['crippling'],
        permanent: true,
        treatment:
            'Nothing, and the reason is a rule rather than a shortage. Getting to this rung is your own effort - helpers are allowed at that crossing and medicine is not - so the pill that would answer this is barred at exactly the rung that needs it. What is left is an Immortal coming down and using Law on it, which has been recorded once and is not something anybody should plan around.',
        presentation:
            'Tribulation Transcendence, awake, powerful beyond anything the world can field against them, and permanently three rungs from the Lid. Most of them stop being seen. It is not shame - there is simply nothing further to do, and a hundred thousand years is a long time to be asked about it.'
    },
    {
        key: 'burnt-span',
        nature: 'physical',
        name: 'A burnt span',
        description:
            'Years were spent as fuel rather than lived. The body is the age it is now, not the age it was, and nothing about that is reversible - the span was the price of getting through something, and it was paid.',
        severities: ['serious', 'crippling'],
        permanent: true,
        treatment:
            'Nothing below the Lid returns spent years. The rung above returns them, which is exactly the trap: the next crossing is what would pay this back and this is what makes the next crossing unaffordable.',
        presentation:
            'Somebody at a good rung who is old for it and knows the figure to the year. They are usually in a hurry about something and will not explain what.'
    },
    {
        key: 'scattered-cultivation',
        nature: 'physical',
        name: 'Scattered cultivation',
        description:
            'The structure the whole life was built on came apart under the crossing. Whatever is standing here now was laid a second time out of the wreckage of the first, and it remembers being broken.',
        severities: ['crippling'],
        permanent: true,
        treatment:
            'Nothing treats this, because it is not an injury any more - it is what the cultivator is now built on. `rebuildFoundation` is the only thing that ever touched it and it has already run.',
        presentation:
            'A cultivator whose progress does not match their history at all: decades of work behind them and a rate that reads like somebody half their standing. They know precisely why and it is not a story they tell.'
    },
    // Its sibling, and the row that replaced 'a ruined dantian'.
    {
        key: 'incomplete-cultivation',
        nature: 'physical',
        name: 'Incomplete cultivation',
        description:
            'Part of the structure was never formed. What is there holds, badly, and everything drawn into it leaks back out over the following days.',
        severities: ['crippling'],
        permanent: true,
        treatment:
            'Nothing that exists. The two recorded repairs were both performed by somebody above the Lid on somebody they had a reason to keep.',
        presentation:
            'A cultivator at a rung they can no longer supply, living off what they can gather each morning, who is exactly as strong as they say they are for about a quarter of an hour.'
    },

    // ── Mental. Heart demons, and what they become when nothing answers them. ──
    {
        key: 'heart-demon',
        nature: 'mental',
        name: 'A heart demon',
        description:
            'Something the cultivator has not settled with has become load-bearing in their cultivation, and now surfaces whenever they try to draw deeply. It is a specific thing, it has a subject, and the cultivator knows exactly what it is.',
        severities: ['minor', 'serious'],
        permanent: false,
        treatment:
            'Settling the thing itself. Not a pill - there is no pill, and the ones sold as one suppress the surfacing and let the root go deeper. Confession, restitution, finishing the business, or being talked through it by somebody who was there.',
        presentation:
            'Entirely lucid and slightly guarded, with one subject they will not go near. Press it and the composure is visibly load-bearing rather than real.'
    },
    {
        key: 'rooted-heart-demon',
        nature: 'mental',
        name: 'A rooted heart demon',
        description:
            'A heart demon that was carried through a crossing instead of settled, and has been built into the structure that came out the other side. It is no longer about its original subject; it is now part of how this person cultivates at all.',
        severities: ['serious', 'crippling'],
        permanent: true,
        treatment:
            'Nothing reaches it. The thing it was about can be settled and the demon does not care - it stopped being about that at the crossing. This is what half mad means in this world and it is a permanent condition rather than an episode.',
        presentation:
            'Functional, capable, employed, and wrong in a way that takes an afternoon to notice: reasoning that runs correctly from one premise nobody else holds, an intensity that arrives in the wrong places, and a complete and genuine inability to see it. They are not dangerous by default and they are not reliable either.'
    },
    {
        key: 'ascendant-heart-demon',
        nature: 'mental',
        name: 'An ascendant heart demon',
        description:
            'The demon is what is steering. The cultivation is intact, the power is intact, the memory and the skill and the reflexes are all intact, and the person who was using them is not the one using them now.',
        severities: ['crippling'],
        permanent: true,
        treatment:
            'Nothing, and the world has never claimed otherwise. What is done about somebody in this state is done to them rather than for them, by whoever is strong enough, and that is a decision the world makes rather than a treatment.',
        presentation:
            'This is the outcome that is worse than a death and the reason the table has it. Everything that made them formidable is still standing and answering, and nothing is steering it toward anything a person would want. They are not raving and they are not confused - they are purposeful, and the purpose is not theirs.'
    },
    {
        key: 'sundered-recall',
        nature: 'mental',
        name: 'Sundered recall',
        description:
            'The crossing took a stretch of the life with it. Not a fog - a clean absence with edges, which the cultivator can feel the shape of and cannot look into.',
        severities: ['minor', 'serious'],
        permanent: true,
        treatment:
            'Nothing restores it. It can be filled in from outside by people who were there, and what gets filled in is testimony rather than memory, which the cultivator can usually tell.',
        presentation:
            'Someone assembling their own past out of what they have been told, quite openly, and checking it against anybody who might have been present. Vulnerable to being told the wrong thing on purpose, and aware of that too.'
    },
    {
        key: 'fixed-premise',
        nature: 'mental',
        name: 'A fixed premise',
        description:
            'One thing the cultivator concluded under the pressure of the crossing has been set beyond reach of revision. Everything reasoned from it is sound, and it is the premise that is wrong.',
        severities: ['minor', 'serious'],
        permanent: true,
        treatment:
            'Nothing dislodges the premise. Everything built on it can be argued with successfully, one conclusion at a time, for as long as somebody is willing to keep doing it.',
        presentation:
            'Articulate, correct on every detail, and consistently arriving somewhere nobody else arrives. Being contradicted does not agitate them; they restate, competently, and the person contradicting them goes away doubting themselves.'
    }
] as const;

// ─────────────────────────────────────────────────────────────────────────
// LOOKUPS
// O(1) against a prebuilt Map, in the house style.
// ─────────────────────────────────────────────────────────────────────────

const BY_KEY = new Map<string, WoundType>(WOUND_TYPES.map(w => [w.key, w]));

/**
 * Keys that have been retired, and the row that carries their meaning now.
 */
export const RETIRED_WOUND_KEYS: Readonly<Record<string, string>> = {
    'ruined-dantian': 'incomplete-cultivation',
    'unformed-nascent-soul': 'crippled-nascent-soul',
    'incomplete-transformation': 'failed-transformation',
    'damaged-spirit-sense': 'partial-refinement',
    'unstable-joining': 'failed-integration',
    'unset-ascension': 'unfulfilled-ascension',
    'unformed-tribulation-body': 'imperfect-tribulation-body'
};

/** The current key for a wound key, following one retirement if there is one. */
export function currentWoundKey(key: string | null | undefined): string | null {
    if (!key) return null;
    return RETIRED_WOUND_KEYS[key] ?? key;
}

/**
 * The authored row for a wound key, or null.
 */
export function getWoundType(key: string | null | undefined): WoundType | null {
    if (!key) return null;
    return BY_KEY.get(key) ?? BY_KEY.get(RETIRED_WOUND_KEYS[key] ?? '') ?? null;
}

/** Whether this wound key names something nothing in the world closes. */
export function isPermanentWound(key: string | null | undefined): boolean {
    return getWoundType(key)?.permanent ?? false;
}

/**
 * The nature of a wound key. Physical when the key is absent or unknown,
 * because every wound the engine wrote before this table existed was one.
 */
export function woundNature(key: string | null | undefined): WoundNature {
    return getWoundType(key)?.nature ?? 'physical';
}

export function woundTypesByNature(nature: WoundNature): WoundType[] {
    return WOUND_TYPES.filter(w => w.nature === nature);
}

/** Wound types that may legitimately be sustained at this severity. */
export function woundTypesForSeverity(severity: InjurySeverity): WoundType[] {
    return WOUND_TYPES.filter(w => w.severities.includes(severity));
}
