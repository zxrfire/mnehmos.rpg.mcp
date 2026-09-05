/**
 * Killing a beast, and what it costs you only where somebody found out.
 *
 * The assertions that matter are the ones that stop this becoming a
 * reputation system bolted onto hunting:
 *
 *   - nothing is refused. Every beast in the catalog can be killed, and the
 *     module prices rather than forbids
 *   - **the consequence is downstream of the KNOWING, not of the killing.**
 *     `KnowingStage` decides who can open an account, at the rung the ladder
 *     already drew - `placed`, where a name arrives
 *   - the disposition decides the SIGN and never the size, so killing a
 *     demonic beast opens a favour through the same call that opens a grudge
 *   - it only bites where there was an individual: below `BEAST_CORE_ORDINAL`
 *     a hunt returned an amount and there is nothing to answer for
 *   - and at `BEAST_CHANGE_ORDINAL` it stops, because that is a person and a
 *     person's killing is not priced twice
 */

import { describe, it, expect } from 'vitest';

import {
    BEASTS,
    BEAST_CHANGE_ORDINAL,
    BEAST_CORE_ORDINAL,
    requireBeast,
    type Beast
} from '../../../src/data/cultivation/beasts.js';
import {
    KNOWING_STAGES,
    REACHABLE_FROM,
    type KnowingStage
} from '../../../src/engine/social/discovery.js';
import type { Party } from '../../../src/engine/social-leverage/what-a-deed-leaves.js';
import {
    A_KILLING_ACQUIRES_A_NAME_AT,
    WHAT_A_STAGE_MEANS_ABOUT_A_KILLING,
    WHY_NOTHING_PAST_THE_CHANGE_IS_HANDLED_HERE,
    answerabilityOf,
    isAnAmountRatherThanAnAnimal,
    shareOfWhatTheyHad,
    whatTheKillLeft,
    whatTheyLost,
    whoCanPointAtYou,
    whoPaidFor
} from '../../../src/engine/world/who-answers-for-a-beast-that-was-killed.js';

// ─────────────────────────────────────────────────────────────────────────
// FIXTURES
// ─────────────────────────────────────────────────────────────────────────

const KILLER: Party = {
    id: 'p-killer',
    name: 'Yan Shu',
    houseId: null,
    houseName: null,
    alignment: null,
    ranked: false
};

/** A district that had one of the thing and answers to a righteous house. */
const DISTRICT: Party = {
    id: 'p-district',
    name: 'the Six Li hill districts',
    houseId: 'sect-sixmile-wardens',
    houseName: 'the Six Li Wardens',
    alignment: 'righteous',
    ranked: true
};

const DAY = 4_000;

const stagesOf = (entries: readonly [string, KnowingStage][]): Map<string, KnowingStage> =>
    new Map(entries);

/** The friendly thing inside the hunting window - see the catalog test. */
const friendlyInTheWindow = (): Beast => {
    const found = BEASTS.find(b =>
        b.disposition === 'righteous'
        && b.ordinal >= BEAST_CORE_ORDINAL
        && b.ordinal < BEAST_CHANGE_ORDINAL);
    if (!found) throw new Error('no righteous beast inside the hunting window');
    return found;
};

const demonicInTheWindow = (): Beast => {
    const found = BEASTS.find(b =>
        b.disposition === 'demonic'
        && b.ordinal >= BEAST_CORE_ORDINAL
        && b.ordinal < BEAST_CHANGE_ORDINAL);
    if (!found) throw new Error('no demonic beast inside the hunting window');
    return found;
};

// ─────────────────────────────────────────────────────────────────────────

describe('whether there is anything to answer for at all', () => {
    it('returns an amount rather than an animal below the core line', () => {
        for (const b of BEASTS.filter(x => x.ordinal < BEAST_CORE_ORDINAL)) {
            expect(isAnAmountRatherThanAnAnimal(b), b.id).toBe(true);
            expect(answerabilityOf(b, DISTRICT), b.id).toBe('not_an_individual');
        }
        // Even a demonic one, and even with somebody standing right there. The
        // ruling is that there is no point tracking one, so there is no
        // particular animal for anybody to have had a view about.
        const cheapAndNasty = BEASTS.find(b =>
            b.disposition === 'demonic' && b.ordinal < BEAST_CORE_ORDINAL);
        expect(cheapAndNasty).toBeDefined();
        expect(answerabilityOf(cheapAndNasty!, DISTRICT)).toBe('not_an_individual');
    });

    it('stops at the change, because that is a person', () => {
        for (const b of BEASTS.filter(x => x.ordinal >= BEAST_CHANGE_ORDINAL)) {
            expect(answerabilityOf(b, DISTRICT), b.id).toBe('a_person_was_killed');
            expect(answerabilityOf(b, null), b.id).toBe('a_person_was_killed');
        }
        // And it says why rather than pricing it, which is the finding this
        // module reports rather than patches.
        expect(WHY_NOTHING_PAST_THE_CHANGE_IS_HANDLED_HERE.whatIsMissing)
            .toMatch(/no row among the people/i);
    });

    it('has nobody to answer to where the thing was nobody\'s', () => {
        const beast = friendlyInTheWindow();
        expect(answerabilityOf(beast, null)).toBe('nobody_stood_behind_it');
        const left = whatTheKillLeft({
            beast,
            standing: null,
            killer: KILLER,
            stages: stagesOf([['p-district', 'known']]),
            onDay: DAY,
            description: 'Killed on open ground.'
        });
        expect(left.deed).toBeNull();
        expect(left.leaves).toBeNull();
        // The knowing is still reported. People knowing is not the same fact as
        // there being anybody it wronged.
        expect(left.knownTo).toEqual(['p-district']);
        expect(left.line).toMatch(/nobody's/i);
    });
});

describe('the consequence is downstream of the knowing, never of the killing', () => {
    it('opens nothing at all while nobody can put a name to it', () => {
        const beast = friendlyInTheWindow();
        const left = whatTheKillLeft({
            beast,
            standing: DISTRICT,
            killer: KILLER,
            // They know the thing is dead. Nobody knows whose doing it was.
            stages: stagesOf([['p-district', 'named']]),
            onDay: DAY,
            description: 'The hound at the cairns was killed and the core taken.',
            cost: 1
        });
        expect(left.answerability).toBe('answerable');
        expect(left.knownTo).toEqual([]);
        expect(left.deed!.knownTo).toEqual([]);
        expect(left.leaves!.opens, 'an account opened against nobody').toEqual([]);
        expect(left.leaves!.reached).toBe('nobody has worked it out');
    });

    it('opens the account at `placed`, which is where a name arrives', () => {
        const beast = friendlyInTheWindow();
        const at = (stage: KnowingStage): number => whatTheKillLeft({
            beast,
            standing: DISTRICT,
            killer: KILLER,
            stages: stagesOf([['p-district', stage]]),
            onDay: DAY,
            description: 'The hound at the cairns was killed and the core taken.',
            cost: 1
        }).leaves!.opens.length;

        for (const stage of KNOWING_STAGES) {
            const opened = at(stage);
            const shouldOpen = KNOWING_STAGES.indexOf(stage)
                >= KNOWING_STAGES.indexOf(REACHABLE_FROM);
            expect(opened > 0, `${stage} opened ${opened} record(s)`).toBe(shouldOpen);
        }
        // The rung is the ladder's own, not a second copy of it.
        expect(A_KILLING_ACQUIRES_A_NAME_AT).toBe(REACHABLE_FROM);
        expect(A_KILLING_ACQUIRES_A_NAME_AT).toBe('placed');
    });

    it('names every rung, so nobody paraphrases the ladder a sixth time', () => {
        for (const stage of KNOWING_STAGES) {
            expect(WHAT_A_STAGE_MEANS_ABOUT_A_KILLING[stage], stage).toBeTruthy();
        }
        expect(WHAT_A_STAGE_MEANS_ABOUT_A_KILLING.named).toMatch(/no account opens/i);
    });

    it('is exactly the ladder\'s own predicate and nothing more', () => {
        const stages = stagesOf([
            ['a', 'unaware'], ['b', 'whisper'], ['c', 'named'],
            ['d', 'placed'], ['e', 'encountered'], ['f', 'known']
        ]);
        expect([...whoCanPointAtYou(stages)]).toEqual(['d', 'e', 'f']);
        expect(whoCanPointAtYou(new Map())).toEqual([]);
    });

    it('lets a killing be named years later at full weight, with no timer', () => {
        const beast = friendlyInTheWindow();
        const shared = {
            beast,
            standing: DISTRICT,
            killer: KILLER,
            onDay: DAY,
            description: 'The hound at the cairns was killed and the core taken.',
            cost: 1
        } as const;
        const quiet = whatTheKillLeft({ ...shared, stages: stagesOf([['p-district', 'named']]) });
        // Somebody who was there tells them. `told` reaches `placed`, and
        // stages never fall, so the account opens now and is dated to the deed.
        const later = whatTheKillLeft({ ...shared, stages: stagesOf([['p-district', 'placed']]) });

        expect(quiet.leaves!.opens).toEqual([]);
        expect(later.leaves!.opens.length).toBeGreaterThan(0);
        expect(later.leaves!.opens[0]!.onDay, 'the record is dated to the telling').toBe(DAY);
        expect(later.leaves!.weight, 'the delay discounted it').toBe(
            whatTheKillLeft({
                ...shared,
                stages: stagesOf([['p-district', 'known']])
            }).leaves!.weight
        );
    });
});

describe('the disposition decides the sign, and the caller decides the size', () => {
    it('makes killing a friendly one a wrong the standing party holds', () => {
        const beast = friendlyInTheWindow();
        expect(whoPaidFor(beast)).toBe('subject');
        expect(whatTheyLost(beast)).toBe('the thing and what it was doing');

        const left = whatTheKillLeft({
            beast,
            standing: DISTRICT,
            killer: KILLER,
            stages: stagesOf([['p-district', 'known']]),
            onDay: DAY,
            description: 'The hound at the cairns was killed and the core taken.',
            cost: 1
        });
        const personal = left.leaves!.opens.find(o => o.holderId === DISTRICT.id);
        expect(personal, 'the district holds nothing').toBeDefined();
        expect(personal!.kind).toBe('grudge');
        expect(personal!.subjectId).toBe(KILLER.id);
        expect(left.leaves!.shame, 'nothing sticks to the killer').not.toBeNull();
    });

    it('makes killing a demonic one a favour, through the same call', () => {
        const beast = demonicInTheWindow();
        expect(whoPaidFor(beast)).toBe('actor');
        expect(whatTheyLost(beast)).toBe('nothing, and they are better off');

        const left = whatTheKillLeft({
            beast,
            standing: DISTRICT,
            killer: KILLER,
            stages: stagesOf([['p-district', 'known'], ['p-killer', 'known']]),
            onDay: DAY,
            description: 'The thing that had been counting the parties is dead.',
            cost: 1
        });
        // A favour is held BY whoever paid for it. The killer went out and did
        // the dangerous thing, so the killer holds it and the district owes.
        const favour = left.leaves!.opens.find(o => o.holderId === KILLER.id);
        expect(favour, 'nobody owes the killer anything').toBeDefined();
        expect(favour!.kind).toBe('favor');
        expect(favour!.subjectId).toBe(DISTRICT.id);
        expect(left.leaves!.shame, 'a favour left shame behind').toBeNull();
    });

    it('does not price a righteous one heavier for being righteous', () => {
        // The weight comes from what it cost them, not from the word. Two
        // beasts at the same cost, one righteous and one neutral, weigh the
        // same - and the difference between them is that a neutral animal on
        // open ground usually has nobody standing behind it at all.
        const neutral = BEASTS.find(b =>
            b.disposition === 'neutral'
            && b.ordinal >= BEAST_CORE_ORDINAL
            && b.ordinal < BEAST_CHANGE_ORDINAL);
        expect(neutral).toBeDefined();
        const weigh = (beast: Beast): string => whatTheKillLeft({
            beast,
            standing: DISTRICT,
            killer: KILLER,
            stages: stagesOf([['p-district', 'known']]),
            onDay: DAY,
            description: 'Killed for the core.',
            cost: 0.5
        }).leaves!.weight;
        expect(weigh(friendlyInTheWindow())).toBe(weigh(neutral!));
    });

    it('defaults the share to what stood together, and lets a caller say better', () => {
        const solitary = friendlyInTheWindow();
        expect(solitary.groupSize).toBe(1);
        expect(shareOfWhatTheyHad({ beast: solitary })).toBe(1);
        expect(shareOfWhatTheyHad({ beast: solitary, howManyTheyHad: 4 })).toBe(0.25);
        // A herd is a fraction of itself, not the whole of anything.
        const herd = requireBeast('beast-vein-deer');
        expect(shareOfWhatTheyHad({ beast: herd })).toBeCloseTo(1 / herd.groupSize, 10);
        // Clamped rather than thrown, and never a division by zero.
        expect(shareOfWhatTheyHad({ beast: solitary, howManyTheyHad: 0 })).toBe(1);
        expect(shareOfWhatTheyHad({ beast: solitary, howManyTheyHad: -3 })).toBe(1);
    });
});

describe('nothing is refused, and nothing branches on it being a beast', () => {
    it('prices every beast in the catalog rather than forbidding any of them', () => {
        for (const beast of BEASTS) {
            const left = whatTheKillLeft({
                beast,
                standing: DISTRICT,
                killer: KILLER,
                stages: stagesOf([['p-district', 'known']]),
                onDay: DAY,
                description: 'It is dead.',
                cost: 0.5
            });
            // An answer every time. Never a throw, never a refusal, and the
            // line always says what the world made of it.
            expect(left.line.length, beast.id).toBeGreaterThan(0);
            expect(
                ['not_an_individual', 'a_person_was_killed', 'nobody_stood_behind_it', 'answerable']
            ).toContain(left.answerability);
        }
    });

    it('marks the record as a kill without the ledger having to know what died', () => {
        const beast = friendlyInTheWindow();
        const left = whatTheKillLeft({
            beast,
            standing: DISTRICT,
            killer: KILLER,
            stages: stagesOf([['p-district', 'known']]),
            onDay: DAY,
            description: 'Killed for the core.',
            cost: 1
        });
        expect(left.deed!.tags).toContain('beast_kill');
        expect(left.deed!.tags).toContain(`disposition:${beast.disposition}`);
        // Below the change the body is the whole of them, so it never comes
        // back - the one field this module can answer without asking.
        expect(left.deed!.irreversible).toBe(true);
    });
});
