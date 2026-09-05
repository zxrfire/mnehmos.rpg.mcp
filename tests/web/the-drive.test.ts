/**
 * THE THREE QUESTIONS A DRIVEN PLAYER ASKS, AND WHAT THEY MUST NOT ANSWER WITH.
 *
 * `scripts/playtest-the-drive.mjs` measures these over a real server, in the
 * words a person types, and it is the authority on whether they are ASKABLE.
 * This file is the authority on whether the answers are HONEST, which is a
 * different property and much easier to lose: every defect below was in the
 * first build of these three reads and every one of them scored as a pass on
 * the harness.
 *
 *   a fabricated zero      every settlement in the player's own province came
 *                          back "0 days away". Nothing in the catalog prices a
 *                          road between two towns of one region, so the zero
 *                          was invented, and it is exactly the kind of number
 *                          a player plans around.
 *   a dropped scale        provinces are the ONLY names in this world with a
 *                          stated `travelDays` beside them, and the lookup
 *                          searched settlements only - so the travel-cost half
 *                          of the answer was dead code that never ran once.
 *   a borrowed ceiling     the current province's ceiling was taken from the
 *                          first row of a sorted list when the player's own
 *                          settlement was missing from it, which reports
 *                          another region's number as though it were this one's.
 *   a leaked name          the reason this file leans hardest on discovery. A
 *                          roster read that prints its roster hands the player
 *                          a cast list they did not earn.
 *
 * The through-line: all three reads are RENDERERS. They may restate a number
 * the engine computed and they may not produce one. A test that only checks
 * "did it say something" cannot tell those apart, so every assertion here is
 * about a specific figure or a specific silence.
 */

import { describe, it, expect } from 'vitest';
import { whyProgressHasStopped } from '../../src/web/why-progress-has-stopped';
import { whoWouldTeach, type SomebodyAbove } from '../../src/web/who-would-teach-this-cultivator';
import { whereCouldTheyGo, type Destination } from '../../src/web/where-this-cultivator-could-go';
import { techniqueCeiling, NO_MANUAL_CEILING } from '../../src/engine/cultivation/cultivation';
import { rankName } from '../../src/engine/cultivation/realms';
import { parseIntent } from '../../src/web/actions';
import { KnowledgeGate } from '../../src/web/knowledge';
import { SECTS } from '../../src/data/cultivation/sects';
import { getMembersOf } from '../../src/data/cultivation/members';
import { REGIONS, requireRegion } from '../../src/data/cultivation/regions';
import { standingOf } from '../../src/server/consolidated/cultivation-mortal';
import { makeGame, planned } from './harness';

// ─────────────────────────────────────────────────────────────────────────
// WHY AM I STUCK
// ─────────────────────────────────────────────────────────────────────────

/** A cultivator with nothing wrong with them, as a baseline to vary from. */
const UNBLOCKED = {
    name: 'Shi Wanjun',
    ordinal: 4,
    manual: techniqueCeiling(4, 13),
    manualCap: 13,
    regionName: 'The Jade Gorge',
    localCeilingOrdinal: 20,
    canAdvanceHere: true,
    ambient: 'normal' as const,
    rank: null,
    progressRequired: 100,
    progressAvailable: 100,
    eligible: true,
    yearsAtCurrentRealm: 2,
    stagnationYears: 50
};

describe('why progress has stopped', () => {
    it('names the manual, the bar and where they stand, in one sentence', () => {
        // The register the whole brief is written against: name the thing,
        // name the bar, name where the player actually is.
        const read = whyProgressHasStopped({
            ...UNBLOCKED,
            ordinal: 13,
            manual: techniqueCeiling(13, 13),
            manualCap: 13
        });
        const line = read.lines.find(l => l.includes('carries to'));
        expect(line).toBeDefined();
        expect(line).toContain(rankName(13));
        expect(line).toContain('standing at');
    });

    it('says there is no book rather than naming one that does not exist', () => {
        // The defect `techniqueCeiling` was written to fix, asserted at this
        // layer too: a cap of zero is an ABSENT manual, and reporting it as
        // "the manual ends at Layer 1" names a book to somebody holding none.
        const read = whyProgressHasStopped({
            ...UNBLOCKED,
            ordinal: 0,
            manual: techniqueCeiling(0, NO_MANUAL_CEILING),
            manualCap: NO_MANUAL_CEILING
        });
        expect(read.gates[0].kind).toBe('no_method');
        expect(read.lines[0]).toContain('no cultivation method');
        expect(read.lines[0]).not.toContain('manual ends');
    });

    it('puts every hard gate in the required channel', () => {
        // The measured failure this channel exists for: a model receives the
        // ceiling sentence inside a long digest and drops it, and a cultivator
        // sits for fifty years without being told why.
        const read = whyProgressHasStopped({
            ...UNBLOCKED,
            ordinal: 0,
            manual: techniqueCeiling(0, NO_MANUAL_CEILING),
            manualCap: NO_MANUAL_CEILING
        });
        const hard = read.gates.filter(g => g.hard);
        expect(hard.length).toBeGreaterThan(0);
        for (const gate of hard) expect(read.required).toContain(gate.line);
    });

    it('orders the wall above the queue', () => {
        // Somebody with no book must not be told about their sect's
        // contribution requirement first. One of those is a wall and the other
        // is a queue, and leading with the queue spends a decade on the wrong
        // problem.
        const read = whyProgressHasStopped({
            ...UNBLOCKED,
            ordinal: 0,
            manual: techniqueCeiling(0, NO_MANUAL_CEILING),
            manualCap: NO_MANUAL_CEILING,
            rank: {
                sectName: 'Azure Dew Sect',
                rankTitle: 'Dew Servant',
                nextRankTitle: 'Dew Disciple',
                requiredOrdinal: 6,
                requiredContribution: 100,
                contribution: 0
            }
        });
        expect(read.gates[0].hard).toBe(true);
        expect(read.gates[0].kind).toBe('no_method');
    });

    it('reports the province ceiling as a fact about the province', () => {
        const read = whyProgressHasStopped({ ...UNBLOCKED, canAdvanceHere: false });
        const line = read.lines.find(l => l.includes('The Jade Gorge'));
        expect(line).toContain(rankName(20));
        expect(line).toContain(rankName(4));
    });

    it('says nothing is stopping them when nothing is', () => {
        // Silence is indistinguishable from a bug. "Nothing is in your way" is
        // an answer to "why am I stuck" and has to be said out loud.
        const read = whyProgressHasStopped(UNBLOCKED);
        expect(read.gates.some(g => g.kind === 'open')).toBe(true);
        expect(read.required).toEqual([]);
    });

    it('warns about the settling clock before it is spent, not after', () => {
        const read = whyProgressHasStopped({
            ...UNBLOCKED,
            yearsAtCurrentRealm: 61,
            stagnationYears: 50
        });
        const clock = read.gates.find(g => g.kind === 'clock');
        expect(clock?.hard).toBe(true);
        expect(clock?.line).toContain('11 years past');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// WHO CAN TEACH ME
// ─────────────────────────────────────────────────────────────────────────

const MASTER: SomebodyAbove = {
    name: 'Elder Fang',
    realmOrdinal: 9,
    rankTitle: 'Dew Elder',
    willTeach: true,
    knows: 'the opening three stages of the Azure Ripple Art',
    mayNotSay: 'anything of the inner shelf, on the sect head\'s standing order',
    costsThem: 'a month of their own seclusion for every disciple taken',
    here: true
};

/** The same person, before the player has ever met them. */
const STRANGER: SomebodyAbove = {
    ...MASTER,
    name: null,
    rankTitle: null,
    knows: null,
    mayNotSay: null,
    costsThem: null
};

describe('who would teach this cultivator', () => {
    it('keeps the three limits separate', () => {
        // Merging them is how a master becomes an oracle, which is the one
        // thing `asking.md` forbids. All three apply at once.
        const read = whoWouldTeach({
            name: 'Shi Wanjun',
            ordinal: 4,
            placeName: 'Cloud Gate',
            sectName: 'Azure Dew Sect',
            above: [MASTER],
            manualState: 'teaching'
        });
        const text = read.lines.join('\n');
        expect(text).toContain('What they hold:');
        expect(text).toContain('What they will not say:');
        expect(text).toContain('What asking costs them:');
    });

    it('names the gap in rungs, not just the rank', () => {
        const read = whoWouldTeach({
            name: 'Shi Wanjun',
            ordinal: 4,
            placeName: 'Cloud Gate',
            sectName: 'Azure Dew Sect',
            above: [MASTER],
            manualState: 'teaching'
        });
        expect(read.lines[0]).toContain('Elder Fang');
        expect(read.lines[0]).toContain('5 rungs above you');
    });

    it('never leaks a name the player has no record for', () => {
        // The rule `docs/world/houses/discovery.md` is emphatic about, and the one a
        // roster read breaks by accident: walking a roster and printing it
        // hands the player a cast list they did not earn.
        const read = whoWouldTeach({
            name: 'Shi Wanjun',
            ordinal: 4,
            placeName: 'Cloud Gate',
            sectName: 'Azure Dew Sect',
            above: [STRANGER],
            manualState: 'teaching'
        });
        const text = read.lines.join('\n');
        expect(text).not.toContain('Elder Fang');
        expect(text).not.toContain('Dew Elder');
        // Nor the teaching limits, which would identify them just as well.
        expect(text).not.toContain('Azure Ripple');
        expect(read.nameable).toBe(0);
    });

    it('still reports the count and the altitude of who it will not name', () => {
        // The shape of what is hidden is information the player is entitled
        // to. A count and an altitude are not an introduction.
        const read = whoWouldTeach({
            name: 'Shi Wanjun',
            ordinal: 4,
            placeName: 'Cloud Gate',
            sectName: 'Azure Dew Sect',
            above: [STRANGER, { ...STRANGER, realmOrdinal: 7 }],
            manualState: 'teaching'
        });
        const text = read.lines.join('\n');
        expect(text).toContain('2 people');
        expect(text).toContain('5 rungs up');
    });

    it('answers "nobody you know of" rather than refusing', () => {
        // The emptiness IS the reply. The question was understood.
        const read = whoWouldTeach({
            name: 'Shi Wanjun',
            ordinal: 4,
            placeName: 'Cloud Gate',
            sectName: null,
            above: [],
            manualState: 'teaching'
        });
        expect(read.lines.join('\n')).toContain('Nobody you know of');
    });

    it('does not say the same thing twice when nobody can be named', () => {
        const read = whoWouldTeach({
            name: 'Shi Wanjun',
            ordinal: 4,
            placeName: 'Cloud Gate',
            sectName: null,
            above: [STRANGER],
            manualState: 'teaching'
        });
        const sayings = read.lines.filter(l => /no name|name to none/i.test(l));
        expect(sayings).toHaveLength(1);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// WHERE CAN I GO
// ─────────────────────────────────────────────────────────────────────────

const HOME: Destination = {
    name: 'Autumn Gate',
    kind: 'market_town',
    ambient: 'normal',
    regionName: 'The Yellow Plain',
    travelDays: null,
    localCeilingOrdinal: 38,
    hereNow: true,
    sameProvince: true
};

const NEIGHBOUR: Destination = {
    name: 'The Jade Gorge',
    kind: 'province',
    ambient: null,
    regionName: 'The Jade Gorge',
    travelDays: 12,
    localCeilingOrdinal: 20,
    hereNow: false,
    sameProvince: false
};

describe('where this cultivator could go', () => {
    it('never invents a distance the catalog does not state', () => {
        // The fabricated zero. Nothing prices a road between two settlements
        // of one province, and "0 days away" is a number a player plans
        // around that the engine never said.
        const read = whereCouldTheyGo({
            ordinal: 1,
            placeName: 'Autumn Gate',
            regionName: 'The Yellow Plain',
            localCeilingOrdinal: 38,
            reachable: [HOME, { ...HOME, name: 'Old River Village', kind: 'village', hereNow: false }],
            unplaceable: 0
        });
        expect(read.lines.join('\n')).not.toMatch(/\b0 days\b/);
    });

    it('prices a province, which is the scale the catalog actually prices', () => {
        const read = whereCouldTheyGo({
            ordinal: 1,
            placeName: 'Autumn Gate',
            regionName: 'The Yellow Plain',
            localCeilingOrdinal: 38,
            reachable: [HOME, NEIGHBOUR],
            unplaceable: 0
        });
        expect(read.lines.join('\n')).toContain('12 days away');
    });

    it('states the current province ceiling from the province, never from a list', () => {
        // The borrowed ceiling. The player's own settlement is not guaranteed
        // to be in `reachable`, and taking the figure from the first row
        // reports another region's number as though it were this one's.
        const read = whereCouldTheyGo({
            ordinal: 1,
            placeName: 'Autumn Gate',
            regionName: 'The Yellow Plain',
            localCeilingOrdinal: 38,
            reachable: [NEIGHBOUR],
            unplaceable: 0
        });
        expect(read.lines[0]).toContain(rankName(38));
        expect(read.lines[0]).not.toContain(rankName(20));
    });

    it('counts what it will not name', () => {
        // `REACHABLE_FROM` is `placed`. A name caught through a wall is a name
        // and not a destination, and listing it would promote a whisper into a
        // road and spend a discovery the player was meant to earn.
        const read = whereCouldTheyGo({
            ordinal: 1,
            placeName: 'Autumn Gate',
            regionName: 'The Yellow Plain',
            localCeilingOrdinal: 38,
            reachable: [HOME],
            unplaceable: 3
        });
        expect(read.lines.join('\n')).toContain('3 further names');
    });

    it('puts ground that is not this ground first', () => {
        const read = whereCouldTheyGo({
            ordinal: 1,
            placeName: 'Autumn Gate',
            regionName: 'The Yellow Plain',
            localCeilingOrdinal: 38,
            reachable: [HOME, NEIGHBOUR],
            unplaceable: 0
        });
        // Line 0 is where they are standing; line 1 is the first destination.
        expect(read.lines[1]).toContain('The Jade Gorge');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE ROUTING, WHICH IS WHERE ALL THREE WERE ACTUALLY LOST
// ─────────────────────────────────────────────────────────────────────────

describe('the three questions reach the three reads', () => {
    /**
     * The exact sentences the drive harness measured as DEFLECTED.
     *
     * A deflection is worse than a refusal: the engine replied, the reply
     * looked like an answer, and it was about something else. All three were
     * eaten by a verb that was doing its own job correctly.
     */
    const STOLEN: ReadonlyArray<readonly [string, string, string]> = [
        ['am I stuck', 'ceiling', 'a senior\'s opinion of the player'],
        ['who could guide my cultivation', 'teacher', 'the character sheet'],
        ['I look for a master', 'teacher', 'the room description'],
        ['I want to travel somewhere else', 'destinations', 'a place called "somewhere else"']
    ];

    for (const [text, action, wasAnsweredWith] of STOLEN) {
        it(`"${text}" is no longer answered with ${wasAnsweredWith}`, () => {
            expect(parseIntent(text).action).toBe(action);
        });
    }

    it('does not steal a real journey from the move verb', () => {
        // The failure pointed the other way, which is the one a widening
        // introduces. A sentence that names a place is a journey.
        expect(parseIntent('I travel to Barrow Hand').action).toBe('move');
        expect(parseIntent('I head north').action).toBe('move');
    });

    it('does not steal a real fight from the attack verb', () => {
        // `wall` and `ceiling` were exempted from the attack branch so that
        // "have I hit a wall" could route here. Nothing else may move.
        expect(parseIntent('I attack the nearest cultivator').action).toBe('attack');
        expect(parseIntent('have I hit a wall').action).toBe('ceiling');
    });

    it('does not steal the sect question, which already worked', () => {
        expect(parseIntent('which sects would accept me').action).toBe('sect');
        expect(parseIntent('I want to join a sect').action).toBe('sect');
    });

    /**
     * The wiring, against the real catalog rather than a fixture.
     *
     * The renderer tests above prove the three limits are kept separate once
     * they arrive. This proves they arrive: `rosterFor` carries the role and
     * `teaching.knows`, and `mayNotSay` / `costsThem` / the seat title live
     * only on the `members.ts` row, so the handler has to join the two. A
     * fixture cannot catch that join being wrong.
     */
    it('surfaces a real catalog master once the player has a record for them', async () => {
        const house = SECTS.find(sect =>
            getMembersOf(sect.id).some(m => m.role === 'master' && m.teaching));
        expect(house, 'no sect in the catalog holds a teaching master').toBeDefined();
        const master = getMembersOf(house!.id).find(m => m.role === 'master' && m.teaching)!;

        const { game, db, repos } = makeGame();
        const { cultivator } = await game.newRun('Shi Wanjun');
        repos.sects.addMember(house!.id, cultivator.id, 0);

        // Earn the record rather than bypassing the gate: this is exactly the
        // step the read refuses to skip, so the test must not skip it either.
        new KnowledgeGate(db).learn({
            holderId: cultivator.id,
            kind: 'cultivator',
            id: master.id,
            name: master.name,
            onDay: 0,
            sourceKind: 'witnessed',
            stage: 'encountered'
        });

        const text = (await game.act('who can teach me')).narration;
        expect(text).toContain(master.name);
        expect(text).toContain('teaches');
        expect(text).toContain(master.teaching!.mayNotSay);
        expect(text).toContain(master.teaching!.costsThem);
    });

    /**
     * The cross-province path, which was dead code in the first build.
     *
     * Provinces are the only names in this world with a stated `travelDays`
     * beside them. The first version of the destinations read looked up
     * settlements only, so every province the player knew was dropped, the
     * cost map never returned a row, and the answer was five towns in the
     * player's own region all reported as zero days away.
     *
     * The choice this restores is a real one and the numbers are the catalog's:
     * from The Yellow Plain, The Jade Gorge is 6 days away and carries to the top
     * of the ladder, and The Drowned Sea is 21 days away and carries nobody
     * past the second rung.
     */
    it('prices a province the player can place, in days off the catalog', async () => {
        const { game, db } = makeGame();
        const { cultivator } = await game.newRun('Shi Wanjun');

        // Derived from where the birth actually put them, never asserted: the
        // starting province is a draw, and a test that hardcodes one measures
        // the seed rather than the read.
        const from = requireRegion(standingOf(cultivator as never).regionId);
        const link = from.connections.find(c => c.otherRegionId !== from.id)!;
        const to = REGIONS.find(r => r.id === link.otherRegionId)!;

        // `REACHABLE_FROM` is `placed`. Anything below it is a name, not a road.
        new KnowledgeGate(db).learn({
            holderId: cultivator.id,
            kind: 'place',
            id: to.id,
            name: to.name,
            onDay: 0,
            sourceKind: 'told',
            stage: 'placed'
        });

        const text = (await game.act('where can I go')).narration;
        expect(text).toContain(to.name);
        expect(text).toContain(`${link.travelDays} days away`);
    });

    it('costs the player nothing when it fires', async () => {
        // All three are reads. A player standing at a wall has to be able to
        // ask what it is a hundred times and lose nothing but a moment.
        const { game } = makeGame();
        await game.newRun('Shi Wanjun');
        for (const text of ['what is my ceiling', 'who can teach me', 'where can I go']) {
            const before = (await game.act('status')).state.elapsedDays;
            const result = await game.act(text);
            expect(planned(result).action).not.toBe('unclear');
            expect(result.state.elapsedDays).toBe(before);
        }
    });
});
