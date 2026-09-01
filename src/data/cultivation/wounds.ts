/**
 * The wound table - every way a person in this world can be hurt, as data.
 *
 * A wound is a ROW, never a phrase. That is the whole reason this file exists,
 * and it is the same rule already enforced on breakthroughs and on place names:
 * the narrator reads what happened to somebody out of a record, and cannot
 * invent it. "Half mad from a heart demon at the Nascent Soul wall" has to be a
 * `woundType` that resolves here, with an authored description, or it is a
 * hallucination wearing the engine's voice.
 *
 * ── ONE LIST, TWO NATURES ────────────────────────────────────────────────
 *
 * Every person carries one list of wounds and it may be empty. A healthy
 * cultivator has nothing here and that is the ordinary case.
 *
 * `injuries.ts` already had severity, source, `treated` and the two penalties,
 * and all of it was physical. Heart demons, madness and half-madness are the
 * SAME KIND OF RECORD with a different nature - so they are rows in this table
 * with `nature: 'mental'`, carried in the same array, read by the same
 * aggregation. A parallel "mental affliction" system beside the injury list is
 * the exact mistake this project keeps almost making, and it would mean nothing
 * downstream ever noticed a mad elder, because nothing downstream reads a
 * second list.
 *
 * ── PERMANENCE IS A PROPERTY OF THE TYPE, NOT OF THE ROW ─────────────────
 *
 * Three states, and they are genuinely different:
 *
 *   open        `treated: false`, and something could close it. Drags on
 *               cultivation and breakthrough odds until it does. The ratchet.
 *   closed      `treated: true`. Scar tissue - worth a little judgement,
 *               and past `SCAR_PLATEAU` worth less than nothing. See
 *               `scarTempering`.
 *   permanent   `permanent: true` HERE, in the type. Nothing closes it, ever,
 *               so it stays `treated: false` for the rest of the life and goes
 *               on costing. What it must NOT do is count toward the bleed-out
 *               clock: a cultivator whose left meridians were burned away at
 *               the Deity Transformation wall is maimed for good and is not
 *               bleeding to death from it. `bleedingInjuryCount` in
 *               `injuries.ts` is the predicate that draws that line.
 *
 * ── WHAT WOULD TREAT IT, EVEN WHERE NOTHING CAN ──────────────────────────
 *
 * Every row says what would answer it. Several say that nothing in the world
 * currently can, and that is a deliberate and useful answer rather than a gap:
 * it is the difference between a wound nobody has got around to curing and a
 * wound the setting says is not curable. A player who asks a physician about a
 * rooted heart demon should be told the second thing, and told it out of this
 * table.
 *
 * ── STRUCTURAL-REPAIR MEDICINE, AND WHY MOST PEOPLE NEVER SEE ANY ────────
 *
 * NOT YET BUILT. Specified here because this is the file the wounds it would
 * answer live in, and because the design point matters more than the item.
 *
 * The broken statuses below - a cracked core, an unformed nascent soul, a
 * failed body joining - each name a pill grade that would repair them. That
 * medicine is meant to be RARE TO A DEGREE WHERE MOST PEOPLE JUST LIVE WITH IT.
 * The test is not what a dose costs; it is what fraction of the cultivators
 * carrying a structural break are ever repaired, and the answer has to be
 * almost none. If a meaningful share of them get fixed, the medicine is too
 * available whatever its price in stones.
 *
 * That is what makes it an apex advantage, and the advantage is sharper than
 * affordability: apex clans and Dao houses are very nearly the only places the
 * stuff EXISTS, so for everybody else the question of paying for it never comes
 * up. A dose handed to a promising junior is access to an outcome that is
 * otherwise unavailable at any price, which is why that favour is worth what it
 * is worth.
 *
 * Four grades - mortal, earth, heaven, immortal - matching the scheme every
 * other consumable uses. The immortal grade is sent down from above the Lid and
 * cannot be made on this side. Repair reaches ordinal 40 and stops: getting to
 * 41 is your own effort, helpers are allowed at that crossing and medicine is
 * not, which is why `unformed-tribulation-body` is the one break with no
 * treatment behind it at all.
 *
 * WHEN IT IS BUILT, THE HIGH GRADES MUST BE TRACKED. `docs/world/items.md`'s
 * term of art: a heaven- or immortal-grade repair pill is a ROW with a holder
 * and a provenance, never a fungible count, because where a specific one went
 * is exactly the sort of thing somebody should be able to find out two
 * centuries later. Low grades may be counted.
 *
 * The population consequence is the point and should be allowed to stand: the
 * provinces are full of people at every rung who quietly stopped, at an ordinal
 * far below their age, who do not attempt anything any more and have a reason
 * nobody asks about.
 *
 * ── THE TABLE IS EXPECTED TO GROW ────────────────────────────────────────
 *
 * Adding a wound is adding a row. Nothing indexes this table positionally,
 * nothing hardcodes its length, and no consumer switches on the full set of
 * keys - `getWoundType` returns null for an unknown key and callers treat that
 * as "an ordinary wound of its severity", which is what every row written
 * before this table existed genuinely is.
 *
 * Inert data. Nothing here rolls, resolves or decides. The engine owns the
 * outcome; this file only says what the outcomes are called and what they mean.
 */

import { z } from 'zod';
import type { InjurySeverity } from '../../schema/cultivation.js';

// ─────────────────────────────────────────────────────────────────────────
// THE CONTRACT
// ─────────────────────────────────────────────────────────────────────────

/**
 * Physical or mental, and nothing else.
 *
 * Deliberately only two. A foundation that has been blown apart is a physical
 * wound and a burnt span is a physical wound, because both are things that
 * happened to a body, and inventing a 'structural' and a 'temporal' nature
 * beside these two would put the engine back in the business of maintaining a
 * taxonomy nobody reads. What distinguishes those wounds is the FIELD they
 * move - `foundationQuality`, `age` - not a third word here.
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
     *
     * The field that makes the failure table produce people rather than
     * corpses. An NPC carrying this wound is playable from this sentence: it
     * says what a player sitting across a table from them would actually
     * encounter, which is the whole point of surviving a crossing badly.
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
    {
        key: 'ruined-dantian',
        nature: 'physical',
        name: 'A ruined dantian',
        description:
            'The reservoir itself is cracked rather than the channels feeding it. It holds, badly, and everything drawn into it leaks back out over the following days.',
        severities: ['crippling'],
        permanent: true,
        treatment:
            'Nothing that exists. The two recorded repairs were both performed by somebody above the Lid on somebody they had a reason to keep.',
        presentation:
            'A cultivator at a rung they can no longer supply, living off what they can gather each morning, who is exactly as strong as they say they are for about a quarter of an hour.'
    },

    // ─────────────────────────────────────────────────────────────────
    // THE BROKEN STATUSES - one per realm boundary
    //
    // The population the setting most needed and could not previously
    // produce: a cultivator who CROSSED and can never cross again. They are
    // at the new rung. They made it. They are finished.
    //
    // These are statuses carried on top of an ordinal, never a rank of their
    // own - somebody who cracks going into Tribulation Transcendence is at
    // ordinal 41 with a broken step, not at "half-step 41". The ladder keeps
    // its rungs and the world can still tell the difference between a 41 who
    // is climbing and a 41 who is done, because the difference is written on
    // the person rather than into the ladder.
    //
    // Each names the structure ITS OWN crossing was for, so the status reads
    // as a diagnosis rather than a label. A healer's words: plain, physical,
    // and about the specific thing that did not take.
    //
    // Adding a realm means adding a row here and one line in
    // `BROKEN_STATUS_FOR_TRIAL`. Nothing else knows these apart.
    // ─────────────────────────────────────────────────────────────────
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
        key: 'unformed-nascent-soul',
        nature: 'physical',
        name: 'An unformed nascent soul',
        description:
            'The infant soul was born and did not take. What is in there is the shape of one - it holds the body together and it will never separate from it, which is the entire point of the realm and the one thing this one cannot do.',
        severities: ['crippling'],
        permanent: true,
        treatment:
            'A foundation-repairing pill of heaven grade or better, and the record of one working is a single line four hundred years old.',
        presentation:
            'Nascent Soul in every way that a stranger could check, and mortal in the way that matters: destroy the body and they are gone. They do not advertise it and a great many of them have died of somebody finding out.'
    },
    {
        key: 'incomplete-transformation',
        nature: 'physical',
        name: 'An incomplete transformation',
        description:
            'The form was taken apart and put back together with body and soul lying alongside each other rather than through each other. It works. It is two things wearing one shape, and it will not be raised as one.',
        severities: ['crippling'],
        permanent: true,
        treatment:
            'A foundation-repairing pill of heaven grade or better. The immortal grade is the one that reliably works and it cannot be made on this side.',
        presentation:
            'Deity Transformation, and a half-second of hesitation between deciding and moving that nobody below the realm can see and nobody at it can miss. It is the tell, and their peers are unfailingly polite about it.'
    },
    {
        key: 'damaged-spirit-sense',
        nature: 'physical',
        name: 'Damaged spirit sense',
        description:
            'Refining the self against emptiness is what builds the spirit sense - the reach a cultivator perceives with, out past the body. This one went into the emptiness and the sense came back torn: it extends, it returns wrong, and the errors are not the kind the owner can detect from inside.',
        severities: ['crippling'],
        permanent: true,
        treatment:
            'A foundation-repairing pill of immortal grade. Nothing made below the Lid has ever restored a spirit sense once it has been torn in the emptiness.',
        presentation:
            'Void Refinement, and a reach that reports things which are not there and misses things that are. They compensate by never relying on it - they ask, they send people, they check twice - and it makes them look either extraordinarily careful or extraordinarily suspicious depending on who is describing them.'
    },
    {
        key: 'failed-body-joining',
        nature: 'physical',
        name: 'A failed body joining',
        description:
            'Soul and body were welded from the sinew inward and one seam did not close. Everything moving through this cultivator is enormous, and there is a place where it is not held.',
        severities: ['crippling'],
        permanent: true,
        treatment:
            'A foundation-repairing pill of immortal grade, sent down. Three are known to have been used in the whole of the dated record and one of them was for this.',
        presentation:
            'Body Integration, indivisible everywhere but one place, and the whole of their art is built around not being touched there. It is how people at this realm are killed, and they are the only ones who know precisely where.'
    },
    {
        key: 'unset-ascension',
        nature: 'physical',
        name: 'An unset ascension',
        description:
            'Body, soul, name and dao are raised in that order and the rising stopped partway along. What was raised stays raised. What was not never will be, and the four no longer sit level with each other.',
        severities: ['crippling'],
        permanent: true,
        treatment:
            'A foundation-repairing pill of immortal grade, and it is the last rung anything of the kind reaches. There is no medicine for the crossing above this one.',
        presentation:
            'Grand Ascension, uneven - enormous along the axes that went up and oddly ordinary along the ones that did not. Which is which differs by person and is the single most useful thing to know about any of them.'
    },
    {
        key: 'unformed-tribulation-body',
        nature: 'physical',
        name: 'An unformed tribulation body',
        description:
            'The step into the last realm was taken and did not land clean. They are at the rung, they hold it, and the part of them that would summon a tribulation is the part that broke getting here.',
        severities: ['crippling'],
        permanent: true,
        treatment:
            'Nothing, and the reason is a rule rather than a shortage. Getting to this rung is your own effort - helpers are allowed at that crossing and medicine is not - so the pill that would answer this is barred at exactly the rung that needs it. What is left is an Immortal coming down and using Law on it, which has been recorded once and is not something anybody should plan around.',
        presentation:
            'Tribulation Transcendence, awake, powerful beyond anything the world can field against them, and permanently three rungs from the Lid. Most of them stop being seen. It is not shame - there is simply nothing further to do, and a hundred thousand years is a long time to be asked about it.'
    },
    {
        key: 'span-burnt',
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
        key: 'foundation-shattered',
        nature: 'physical',
        name: 'A shattered foundation',
        description:
            'The structure the whole life was built on came apart under the crossing. Whatever is standing here now was laid a second time out of the wreckage of the first, and it remembers being broken.',
        severities: ['crippling'],
        permanent: true,
        treatment:
            'Nothing treats this, because it is not an injury any more - it is what the cultivator is now built on. `rebuildFoundation` is the only thing that ever touched it and it has already run.',
        presentation:
            'A cultivator whose progress does not match their history at all: decades of work behind them and a rate that reads like somebody half their standing. They know precisely why and it is not a story they tell.'
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
        key: 'heart-demon-rooted',
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
        key: 'heart-demon-ascendant',
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
        key: 'the-fixed-premise',
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
 * The authored row for a wound key, or null.
 *
 * Null is a legitimate answer and every caller must handle it: a wound row
 * written before this table existed carries no key at all, and it is an
 * ordinary wound of its severity. Never throw here - a save file older than
 * this file is not a bug.
 */
export function getWoundType(key: string | null | undefined): WoundType | null {
    if (!key) return null;
    return BY_KEY.get(key) ?? null;
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
