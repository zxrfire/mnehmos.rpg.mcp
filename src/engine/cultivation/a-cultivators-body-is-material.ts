/**
 * A cultivator's body is material, and its grade is the body's own standing.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS: IT GIVES KILLING AN ECONOMIC MOTIVE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Almost everything the social layer models is people harming each other out
 * of want, insult or fear. This is the other one: **harm as harvest.** A core,
 * marrow, blood, bone - a powerful corpse is a prize, which is why the strong
 * travel carefully and why somebody far above you being alone is a situation
 * rather than a fact.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * NO NEW SCALE. NONE AT ALL
 * ═════════════════════════════════════════════════════════════════════════
 *
 * This file introduces no grade ladder, no price table and no catalog. The
 * grade of what comes off a body is the grade `who-can-refine-a-grade-of-
 * medicine.ts` already pins to the realm that body stood at, read in the other
 * direction:
 *
 *     Qi Condensation   ->  mortal
 *     Core Formation    ->  earth
 *     Void Refinement   ->  heaven
 *
 * That is the design owner's own statement - *a Void Refinement cultivator's
 * core is heaven-grade material* - and it needs no arithmetic here because the
 * ladder it names is the ladder already in the file. Take that module away and
 * this one has nothing to say, which is the test AGENTS.md sets.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE CONSEQUENCE THAT MAKES IT A PLOT RATHER THAN A PRICE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The realm gate on production applies UNCHANGED, because it is the same gate.
 * *A cultivator cannot work with materials above their realm.* So somebody at
 * the bottom of the ladder who kills something near the top is holding a thing
 * they **cannot use** and must take to somebody who can - and the somebody who
 * can is by construction a person who will recognise it.
 *
 * That is why {@link Harvest} is a TRACKED object and never counted stock.
 * AGENTS.md: counted stock has a price and no story. This has a provenance, and
 * **the provenance is the crime.** `docs/world/things/items.md`'s *holding is a
 * signature* says a stolen art is evidence for as long as you go on using it;
 * this is worse, because it is evidence that requires you to do nothing at all.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * AND WHY THE WORLD IS NOT FULL OF PEOPLE DOING IT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * On the arithmetic above it would be rational constantly, and that is a world
 * nobody wants. **The gate is not difficulty. It is consequence** - and there
 * is deliberately no gate in this file, no skill check, no permission list and
 * no `if (atWar)`. The act is easy. The aftermath is ruinous, and the aftermath
 * is priced somewhere else entirely: `what-a-deed-leaves.ts` writes a record at
 * the top of the ladder, hands it to the family and the house, and marks it to
 * descend when nobody can be made to answer for it. An ordinary cultivator with
 * a name and prospects looks at a corpse worth a fortune and does not touch it
 * because they can count, not because anybody stopped them.
 *
 * It follows that the conditions under which it DOES happen need no code, and
 * putting them in code would be the bug:
 *
 *   DESPERATION   Somebody with no future has no future cost. The ledger's
 *                 weight is unchanged; what changed is who is reading it.
 *   MADNESS       The character has no agency, so this is a thing that happens
 *                 to their hands. That layer owns it.
 *   WAR           The sharpest one, and it falls out of `heldBy` alone. A shame
 *                 is held by the people who were there, and in a war the people
 *                 who were there are the actor's own side - so nobody near them
 *                 holds it against them, while the other house holds an account
 *                 it already held. Same act, same wound, different bill, and
 *                 not one line of code knows the word "war". It is the
 *                 agreed-bout ruling again: what changes is what it MEANT.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WORKING IT LAUNDERS IT, AND THE LAUNDER MOVES THE FACT RATHER THAN
 * ERASING IT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The raw thing is evidence. `docs/world/things/items.md`'s *holding is a signature*
 * applies at full strength to a core in a pouch: somebody carrying one is
 * carrying a question. **A finished object is not**, and not because anybody
 * lied - the working destroyed what identified it, and spirit beasts give the
 * whole category an innocent origin. A core-grade blade has an explanation that
 * a core does not.
 *
 * So crafting has a motive beyond power: it is how the material becomes
 * sellable at all. And the fact does not vanish - **it moves, out of an object
 * anybody can read and into a person who knows.** Whoever worked it saw what
 * went in.
 *
 * THERE IS NO CODE FOR THAT IN THIS FILE AND THERE MUST NOT BE. A crafter who
 * knows what you brought them is not a new concept, it is an obligation, and
 * the ledger has held obligations all along: write a `leverage` row with
 * `createLeverage`, held BY the crafter ABOUT the client. This file had a
 * three-line helper for it and the helper was the mistake - a small module
 * joining two systems is still a third system, and the next person looking for
 * "who knows this about me" would never have found it filed under laundering.
 *
 * Done as an ordinary row, everything else applies for free: it can be settled
 * (buy them off, or do them a service), inherited (the crafter dies and their
 * apprentice knows), and discovered by somebody working out that this crafter
 * knows something. And `leverage` rather than `favor` because it is not
 * consumed by being used - the crafter is not owed something once, they are
 * permanently in a position, which is exactly why they do not simply turn you
 * in. A client who can be leaned on for a century is worth more than a bounty
 * collected once. The safest object in the world and the most dangerous
 * relationship, bought in one transaction.
 *
 * ── AND FINDING SOMEBODY TO DO IT NEEDS TWO SEPARATE THINGS ──────────────
 *
 * ABLE, which is {@link couldUseItThemselves} - the realm gate, unchanged,
 * because working a corpse into a blade is the same operation as refining a
 * pill from a herb: material of a grade, a hand that reaches it. There is no
 * third version of this rule in this file.
 *
 * WILLING, which is `social-leverage/what-a-house-will-do-about-it.ts` and is
 * about what a crafter's HOUSE permits rather than what they are like. A
 * righteous house's rule is a rule with a price attached; the personal axis is
 * `how-freely-somebody-parts-with-what-they-have.ts` and is deliberately blind
 * to faction, so a righteous crafter is not automatically incorruptible and a
 * demonic one is not automatically willing.
 *
 * The consequence needs no rule to enforce it and is the reason this is
 * self-limiting: **the higher the material, the smaller the set of people who
 * are both able and willing.** A crafter who will work anything cannot reach a
 * heaven-band bone; a crafter who can reach it is by construction somebody with
 * a house, a name and a great deal to lose. A nobody who kills something far
 * above them is left holding a thing that a handful of people in the world can
 * work, every one of whom is a problem.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * MATERIAL IN THE NAME, PROVENANCE IN THE RECORD
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A row reads *"Marrow, heaven grade"*. It does not read as somebody's body.
 * The provenance is a separate fact carried alongside it, in the record and the
 * description, exactly where `docs/world/things/items.md` already puts a tracked
 * object's history - and there are three states of it, of which the middle one
 * is where the game is:
 *
 *   NO CLAIM      Material, priced by grade, fungible to anybody. A bone is a
 *                 bone, and the market for it is an ordinary market.
 *   CLAIMED,      Somebody says whose it was. It might be true. This is where
 *   UNCONFIRMED   forgery lives.
 *   CONFIRMED     A relic, which in `items.md`'s sense stops having a price at
 *                 all: it moves on a favour, on barter, or not at all.
 *
 * So the same object carries two values and which applies is a fact about the
 * buyer. A crafter wanting heaven-band material pays the material price and
 * does not care whose it was. A house that would recognise its own ancestor is
 * not a buyer at any figure - they are somebody it should be returned to.
 *
 * ── The register is flat, because the trade is ordinary ──────────────────
 *
 * Design owner's ruling, and it is mechanical rather than tonal: this is a
 * trade, with prices, grades, crafters and an etiquette, and prose that treated
 * the category as appalling would make the ordinary transaction and the genuine
 * wrong illegible to each other. **The category is ordinary. The offence is
 * always particular** - killing somebody you had no business killing, taking a
 * house's ancestor, defrauding somebody who cannot check. The whole grudge
 * layer depends on that distinction staying readable, so write it the way the
 * engine already writes a killing in an agreed bout: the grade, the price, the
 * provenance, who saw. No shudder anywhere in it.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * TWO EPISTEMICS, AND THEY MUST NOT BE COLLAPSED
 * ═════════════════════════════════════════════════════════════════════════
 *
 *   SOCIAL KNOWLEDGE     what somebody did, what a house is concealing, what
 *                        people say. GOVERNED BY PROXIMITY.
 *                        `social/how-near-you-stand-to-somebody.ts`.
 *   WHAT AN OBJECT IS    does it teach, is it what it claims, how old is it.
 *                        GOVERNED BY REALM.
 *
 * No amount of closeness lets a Qi Condensation cultivator verify a relic, and
 * no distance stops a Void Refinement one: genuine high remains impart dao, and
 * a fake does not, so anybody high enough simply perceives it. Two consequences
 * follow and neither needs a rule:
 *
 *   THE SCAM ONLY WORKS DOWNMARKET. A fake cannot be sold to anybody who
 *   matters, so the whole fake-remains trade preys on people who cannot check -
 *   which is a specific wrong rather than generic fraud.
 *   AND THE VICTIM FINDS OUT BY RISING. Not by investigating and not by being
 *   told: one day they stand at a realm where the object's silence is obvious
 *   and they know exactly who sold it to them. A grudge with a delay measured
 *   in a cultivation career, and `social-leverage/when-somebody-works-out-what-
 *   you-did.ts` is the machinery for it, unchanged. The safest mark is the
 *   weakest one, and the weakest one is the likeliest to still be climbing when
 *   the truth arrives.
 *
 * ── Age is readable, and it is the best laundry there is ─────────────────
 *
 * Old remains are unremarkable: a thousand-year-old bone plausibly came out of
 * a ruin, a tomb or an inheritance, and this world has all three as legitimate
 * supply. **Fresh is a question**, and the question is arithmetic anybody can
 * do rather than a flag on the object: the world knows who has died recently
 * and at what height, the object asserts a death of a given age at a given
 * grade, and somebody who can read both notices they match. There is no
 * `isStolen` field and there must not be one - what this produces instead is
 * *rightly suspected and unprovable*, *wrongly suspected*, and *unsuspected
 * because nobody present could read it*, and a detection flag could produce
 * none of the three.
 *
 * A house that does not announce its deaths therefore makes its own dead
 * untraceable, since there is no announcement to match against. That is two
 * systems meeting and producing something neither was built for, and it is an
 * irony at the expense of the most secretive body in the setting.
 *
 * ── And provenance has no loyalty ────────────────────────────────────────
 *
 * The identical fact - *this was so-and-so* - is proof of a crime if they were
 * not yours to kill and proof of a claim if there was a price on them. Nothing
 * about the object changes; what changes is who is asking. So the launder is a
 * real fork taken before you know how it will be received: destroy the
 * provenance and it is safe, anonymous and unpaid; keep it and it is
 * collectible and damning. Presenting it to an authority means walking into a
 * room holding your evidence, and it is possible to have misjudged which of the
 * two you are carrying.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * NOTHING IS ENUMERATED
 * ═════════════════════════════════════════════════════════════════════════
 *
 * There is no list of body parts and there must not be one. A part is a `part`
 * string carried through untouched and never read, exactly as
 * `what-a-deed-leaves.ts` carries a cause: what the engine knows is that a body
 * yielded material of a grade, from a named person, on a day. A twenty-fourth
 * harvestable thing is a new string in a caller and no code anywhere.
 *
 * Pure. No state, no rolls, no I/O.
 */

import type { TechniqueGrade } from '../../schema/cultivation.js';
import { canRefineGrade, highestGradeRefinableAt } from './who-can-refine-a-grade-of-medicine.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT A BODY IS WORTH AS MATERIAL
// ─────────────────────────────────────────────────────────────────────────

/**
 * The grade of what a body at this rung yields, or null when it yields nothing
 * anybody can work.
 *
 * Null only below the ladder's own bottom rung. Mortal grade opens at ordinal
 * zero, so **every cultivator is material** and somebody off the ladder
 * entirely is not - which is the correct and slightly grim answer, and is why
 * the thing that limits this is consequence rather than eligibility. It is the
 * same threshold that stops a Qi Condensation disciple working heaven-grade
 * herbs, asked of a corpse instead of a herb.
 */
export function gradeOfWhatABodyYields(realmOrdinal: number): TechniqueGrade | null {
    return highestGradeRefinableAt(realmOrdinal);
}

/**
 * One thing taken off one body.
 *
 * Named, dated and attributed, because it is a tracked object. The fields that
 * matter downstream are `fromId` and `fromName`: an unattributed core is not a
 * thing this world can produce.
 */
export interface Harvest {
    /**
     * What was taken, as a word. DATA.
     *
     * Never read by anything in this file. A caller says 'core', 'marrow',
     * 'blood', or something nobody has thought of; the engine records it.
     */
    part: string;
    grade: TechniqueGrade;
    /** Whose it was. The whole of what makes this different from a herb. */
    fromId: string;
    fromName: string;
    /** The rung they stood at, kept so the grade can be checked rather than trusted. */
    fromOrdinal: number;
    onDay: number;
    /** Who took it. */
    byId: string;
}

/** What one body yields, or null when it yields nothing workable. */
export function harvestFrom(input: {
    part: string;
    fromId: string;
    fromName: string;
    fromOrdinal: number;
    byId: string;
    onDay: number;
}): Harvest | null {
    const grade = gradeOfWhatABodyYields(input.fromOrdinal);
    if (grade === null) return null;
    return {
        part: input.part,
        grade,
        fromId: input.fromId,
        fromName: input.fromName,
        fromOrdinal: input.fromOrdinal,
        onDay: input.onDay,
        byId: input.byId
    };
}

/**
 * Whether the holder can do anything with it themselves.
 *
 * The same gate as every other material, because it is the same gate. False is
 * the interesting answer: it means the holder has to find a buyer who stands
 * high enough to use it, and everybody who stands that high can see what it is.
 */
export function couldUseItThemselves(harvest: Harvest, holderOrdinal: number): boolean {
    return canRefineGrade(harvest.grade, holderOrdinal);
}

/**
 * What carrying it says about the person carrying it, in plain words.
 *
 * Factual, for the mechanical channel. It does not accuse anybody of anything -
 * a core can be inherited, bought, or taken off the person who took it - and
 * that ambiguity is the content rather than a gap in it.
 */
export function whatHoldingItSays(harvest: Harvest): string {
    return `${harvest.grade} grade, off ${harvest.fromName}, who stood at ordinal `
        + `${harvest.fromOrdinal}. Anybody who could work it can read all of that off it, and `
        + 'anybody who knew them can read the rest.';
}

/**
 * How much of somebody a harvest cost them, for the deed layer.
 *
 * Always the whole of it, and that is not a judgement - the material only
 * exists because the body is not using it any more. `what-a-deed-leaves.ts`
 * takes cost against what the payer had, and there is no fraction of a life.
 */
export const WHAT_A_HARVEST_COSTS_THE_BODY = 1;
