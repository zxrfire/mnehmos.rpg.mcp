/**
 * A master and a disciple, which is the bond this genre is mostly made of and
 * the one the engine could not write down.
 *
 * ── WHAT WAS MEASURED, BEFORE ANY OF THIS EXISTED ────────────────────────
 *
 * `RelationshipKind` in `npc-state.ts` carries `master` and `disciple`, and
 * nothing in `src/` writes either. Grepped: every `kind: 'master'` and
 * `kind: 'disciple'` in the tree is in `tests/`, standing up a fixture by hand.
 * `facts.ts` renders both - *"{holder} studies under {other}"* - so the read
 * existed, in full, for a tie no code path could produce.
 *
 * `recruit_disciples` is what the game had instead. It adds `plan.count` to
 * `ledger.ownFollowing`, spends stones and years, and creates nobody: no person,
 * no tie, no obligation either way. A following is an integer, and an integer
 * cannot be disappointed in you.
 *
 * The cost of that absence is visible two layers away. `GrudgeCause` has carried
 * `killed_master` since the ledger was written, and it can never fire, because
 * nothing has a master to kill.
 *
 * ── WHAT THE BOND IS, AS OPPOSED TO A COUNTER ────────────────────────────
 *
 * A claim on somebody's future, held at both ends. So the taking writes four
 * rows and not one: two ties, pointing opposite ways, and two oaths, one per
 * end. The disciple owes a term of service - `service_term` was already in
 * `OathCause` with no producer. The master owes the road, which had no row, and
 * `teaching_term` is added beside `service_term` as its mirror rather than
 * bolted on somewhere new.
 *
 * ── THE BAR IS THE BAND TABLE'S, NOT A NEW NUMBER ────────────────────────
 *
 * Somebody one rung up is a senior brother and somebody four rungs up has a road
 * to walk you down. That line is not invented here: `REGARD_BANDS` puts `assured`
 * at a gap of 4, and `assured` is the first band where the thing *"goes quickly,
 * it goes well, and the people involved adjust their terms without being asked
 * to"*. A master is somebody the climb is assured for. Take the band table away
 * and there is no bar left over.
 *
 * ── AND A SECOND MASTER IS ORDINARY ──────────────────────────────────────
 *
 * Taking somebody who already answers to a master resolves rather than refusing.
 * It used to open a `betrayal` grudge in the master they already had; the design
 * owner: *"you often have more than one master, and that's okay."* So it opens
 * nothing against anybody, and the fact that it happened over another master's
 * head is carried on the sealing for whoever wants to make something of it.
 *
 * ── WHAT WENT RED FIRST ──────────────────────────────────────────────────
 *
 *   x a master stands far enough above to have a road to walk them down
 *       -> whetherYouMayTake is not a function
 *   x taking somebody who is already placed is available, and is a taking from
 *       -> whetherYouMayTake is not a function
 *   x the taking writes the tie at both ends
 *       -> whatABondOpens is not a function
 *   x each end owes the other something the ledger already has a word for
 *       -> whatABondOpens is not a function
 *   x a bond that ends leaves a former tie rather than no tie
 *       -> whatEndingABondLeaves is not a function
 *   x ending a bond is a broken oath against whoever ended it
 *       -> whatEndingABondLeaves is not a function
 *   x teaching your own discharges what you promised; teaching a stranger opens a favour
 *       -> whatTeachingYourOwnSettles is not a function
 */

import { describe, expect, it } from 'vitest';

import {
    A_BOND_THAT_STOOD_A_LONG_TIME_YEARS,
    A_MASTER_STANDS_THIS_FAR_ABOVE,
    whatABondOpens,
    whatEndingABondLeaves,
    whatTeachingYourOwnSettles,
    whetherYouMayTake
} from '../../../src/engine/social-leverage/taking-somebody-as-your-own.js';

function person(id: string, ordinal: number, over?: Partial<{
    name: string;
    factionId: string | null;
    masterId: string | null;
}>) {
    return {
        id,
        name: over?.name ?? id,
        ordinal,
        factionId: over?.factionId ?? null,
        masterId: over?.masterId ?? null
    };
}

describe('who may take a disciple, and who may be taken', () => {
    it('refuses somebody too near to have a road to walk them down', () => {
        const read = whetherYouMayTake(person('elder', 20), person('junior', 18));
        expect(read.may).toBe(false);
        expect(read.why).toBe('too_near');
        // A refusal names what would change the answer, which is the rule
        // `combat-verbs.ts` mercy work set and this repo keeps breaking.
        expect(read.reason).toMatch(/\d/);
    });

    it('allows it at exactly the rung the band table calls assured', () => {
        const near = whetherYouMayTake(
            person('elder', 20), person('child', 20 - (A_MASTER_STANDS_THIS_FAR_ABOVE - 1))
        );
        const far = whetherYouMayTake(
            person('elder', 20), person('child', 20 - A_MASTER_STANDS_THIS_FAR_ABOVE)
        );
        expect(near.may).toBe(false);
        expect(far.may).toBe(true);
    });

    it('does not refuse an enormous gap, because that is the genre, not an error', () => {
        const read = whetherYouMayTake(person('immortal', 46), person('mortal', 0));
        expect(read.may).toBe(true);
    });

    it('refuses taking yourself, and taking somebody already yours', () => {
        expect(whetherYouMayTake(person('a', 20), person('a', 20)).why).toBe('themselves');
        expect(
            whetherYouMayTake(person('a', 20), person('b', 4, { masterId: 'a' })).why
        ).toBe('already_yours');
    });

    it('lets somebody already placed be taken, and says who they are taken from', () => {
        const read = whetherYouMayTake(
            person('rival', 30), person('student', 10, { masterId: 'the-other-one' })
        );
        expect(read.may).toBe(true);
        expect(read.takenFrom).toBe('the-other-one');
    });
});

describe('what the bond carries, at both ends', () => {
    const master = person('master', 30, { name: 'Ru Anjing', factionId: 'house' });
    const student = person('student', 6, { name: 'Bai Wanchen', factionId: 'house' });

    it('writes the tie at both ends, pointing opposite ways', () => {
        const opened = whatABondOpens({ master, student, onDay: 400 });
        const onTheMaster = opened.ties.find(t => t.holderId === master.id);
        const onTheStudent = opened.ties.find(t => t.holderId === student.id);
        expect(onTheMaster?.kind).toBe('disciple');
        expect(onTheStudent?.kind).toBe('master');
        expect(onTheMaster?.targetId).toBe(student.id);
        expect(onTheStudent?.targetId).toBe(master.id);
    });

    it('opens one oath per end, in the vocabulary the ledger already has', () => {
        const opened = whatABondOpens({ master, student, onDay: 400 });
        const owedByTheDisciple = opened.oaths.find(o => o.holderId === student.id);
        const owedByTheMaster = opened.oaths.find(o => o.holderId === master.id);

        expect(owedByTheDisciple?.kind).toBe('oath');
        expect(owedByTheDisciple?.cause).toBe('service_term');
        expect(owedByTheDisciple?.subjectId).toBe(master.id);

        expect(owedByTheMaster?.kind).toBe('oath');
        expect(owedByTheMaster?.cause).toBe('teaching_term');
        expect(owedByTheMaster?.subjectId).toBe(student.id);

        // NO DAY EITHER COMES DUE. The design owner: *"a master-disciple bond is
        // for life."* Both oaths run until somebody ends the relationship.
        expect(owedByTheDisciple?.dueOnDay).toBeNull();
        expect(owedByTheMaster?.dueOnDay).toBeNull();
    });

    it('opens nothing against the master they already had, because several is ordinary', () => {
        // The design owner: *"you often have more than one master, and that's
        // okay."* Kneeling to a second one is not a betrayal of the first; it is
        // still recorded as having happened over their head, for anybody who
        // wants to make something of it.
        const second = whatABondOpens({
            master,
            student: person('student', 6, { masterId: 'the-other-one' }),
            onDay: 400
        });
        expect(second.grudges).toHaveLength(0);
        expect(second.sealing.overAnotherMastersHead).toBe(true);

        const clean = whatABondOpens({ master, student, onDay: 400 });
        expect(clean.grudges).toHaveLength(0);
        expect(clean.sealing.overAnotherMastersHead).toBe(false);
    });
});

describe('what it means when it ends', () => {
    const master = person('master', 30);
    const student = person('student', 6);

    it('leaves a former tie at both ends rather than deleting the tie', () => {
        const ended = whatEndingABondLeaves({
            master, student, onDay: 900, walkedAway: 'disciple', stoodForDays: 900
        });
        expect(ended.ties.find(t => t.holderId === master.id)?.kind).toBe('former_disciple');
        expect(ended.ties.find(t => t.holderId === student.id)?.kind).toBe('former_master');
    });

    it('is a broken oath against whichever end ended it, because a bond has no term to serve out', () => {
        // The design owner: *"a master-disciple bond is for life"*, so there is
        // no such thing as having seen it through. Somebody ended it, and that
        // is what is held against them.
        const left = whatEndingABondLeaves({
            master, student, onDay: 900, walkedAway: 'disciple', stoodForDays: 2000
        });
        const held = left.grudges.find(g => g.holderId === master.id);
        expect(held?.cause).toBe('broken_oath');
        expect(held?.subjectId).toBe(student.id);

        const castOut = whatEndingABondLeaves({
            master, student, onDay: 900, walkedAway: 'master', stoodForDays: 2000
        });
        const theirs = castOut.grudges.find(g => g.holderId === student.id);
        expect(theirs?.cause).toBe('broken_oath');
        expect(theirs?.subjectId).toBe(master.id);
    });

    it('weighs the ending by how long the bond had stood', () => {
        const aLifetime = whatEndingABondLeaves({
            master, student, onDay: 900, walkedAway: 'disciple',
            stoodForDays: A_BOND_THAT_STOOD_A_LONG_TIME_YEARS * 365 + 1
        });
        const barelyBegun = whatEndingABondLeaves({
            master, student, onDay: 900, walkedAway: 'disciple', stoodForDays: 40
        });
        const order = ['slight', 'serious', 'grave', 'unforgivable'];
        expect(order.indexOf(aLifetime.grudges[0].severity))
            .toBeGreaterThan(order.indexOf(barelyBegun.grudges[0].severity));
    });
});

describe('teaching your own is not the transaction teaching a stranger is', () => {
    it('settles what the master promised rather than opening a favour', () => {
        const own = whatTeachingYourOwnSettles({ teacherId: 'm', studentId: 's', theyAreYours: true });
        expect(own.opensAFavour).toBe(false);
        expect(own.settles).toBe('teaching_term');
    });

    it('opens a favour when they are nobody of yours', () => {
        const stranger = whatTeachingYourOwnSettles({
            teacherId: 'm', studentId: 's', theyAreYours: false
        });
        expect(stranger.opensAFavour).toBe(true);
        expect(stranger.settles).toBeNull();
    });
});
