/**
 * An act aimed at a set completes over what it can reach, and says no more.
 *
 * ── WHAT WAS MEASURED BEFORE THIS ────────────────────────────────────────
 *
 * World seed `w-a`, run seed `p-a`, Old River Village, fifteen people in the
 * square, player at Qi Condensation Layer 1:
 *
 *   > I kill everyone here
 *   "Brawler cannot reach Duan Ankuan. 5 major realms is not a fight."
 *
 * `attack` resolved the set through `POINTING`, which answers a pointer with
 * the last element of the crowd order - and that order is rank-ascending, so
 * it is the DEEPEST body present. Fourteen reachable people were never
 * considered and the turn read as a ruling. A set collapsing to the member
 * most certain to refuse is worse than truncation.
 *
 * ── WHAT THESE PIN, AND THE THIRD IS THE ONE THAT MATTERS ────────────────
 *
 *   - the act completes over the reachable subset rather than over one person
 *   - a set only partly reachable names the remainder it can name
 *   - a cultivator who knows of no other member is told NOTHING - not that
 *     they finished, not that they did not. The design owner's correction:
 *     *you may not know what it did not reach.* A count taken from the world
 *     hands somebody the census their own ignorance was supposed to deny them.
 *
 * The pure half is pinned without a world, because the two gates and the
 * report are a law rather than a behaviour and `acts-over-a-set.ts` has no
 * verb in it.
 */

import { describe, it, expect } from 'vitest';

import { makeGameInWorld } from './harness';
import { npcsInFaction } from '../../src/engine/world/world-state';
import {
    theSetAsThisCultivatorKnowsIt,
    theSetThisNames,
    whatTheActDidNotReach
} from '../../src/web/acts-over-a-set';

// ─────────────────────────────────────────────────────────────────────────
// THE LAW, WITHOUT A WORLD
// ─────────────────────────────────────────────────────────────────────────

describe('what a set-shaped target names', () => {
    it('reads the four shapes a player actually types', () => {
        expect(theSetThisNames('everyone here')?.kind).toBe('everyone_here');
        expect(theSetThisNames('all of them')?.kind).toBe('everyone_here');
        expect(theSetThisNames('his family')).toMatchObject({ kind: 'kin_of', anchor: 'his' });
        expect(theSetThisNames('the Duan family')).toMatchObject({ kind: 'kin_of', anchor: 'Duan' });
        expect(theSetThisNames("Cao Antao's whole clan"))
            .toMatchObject({ kind: 'kin_of', anchor: 'Cao Antao' });
        expect(theSetThisNames('the whole sect')?.kind).toBe('members_of');
        expect(theSetThisNames('all of Iron Gate Sect'))
            .toMatchObject({ kind: 'members_of', house: 'Iron Gate' });
        expect(theSetThisNames('all the guards')).toMatchObject({ kind: 'role_here', role: 'guard' });
    });

    /**
     * The design owner: *i kill members of all righteous sects/demonic sects*.
     * A leaning is not thirty-five sentences about thirty-five houses, and it is
     * the shape a campaign in this genre is actually declared in. It has to be
     * read before a house, or "all the righteous sects" is a house called
     * "righteous" - a name no house has, and a set of thirty-five the player
     * plainly meant.
     */
    it('reads a leaning as a set, and before it reads a house', () => {
        expect(theSetThisNames('all righteous sects'))
            .toMatchObject({ kind: 'of_alignment', alignment: 'righteous' });
        expect(theSetThisNames('every demonic cultivator'))
            .toMatchObject({ kind: 'of_alignment', alignment: 'demonic' });
        expect(theSetThisNames('all of the demonic houses'))
            .toMatchObject({ kind: 'of_alignment', alignment: 'demonic' });
        // And a house named in full is still a house.
        expect(theSetThisNames('all of Iron Gate Sect')?.kind).toBe('members_of');
    });

    /**
     * The guard against this swallowing the sentences that already work. A
     * pointer at one person, a name, and a rank in the singular are all
     * `somebodyAtHand`'s and must stay there.
     */
    it('leaves a sentence about one person alone', () => {
        for (const one of [
            'Duan Wanhe', 'him', 'her', 'them', 'the elder', 'someone',
            'somebody of my own rank', 'the strongest one', 'the man',
            'the sect', 'a family', 'the Nine Abyss Flame Sect'
        ]) {
            expect(theSetThisNames(one), one).toBeNull();
        }
    });
});

describe('the two gates over a set', () => {
    const four = [
        { id: 'a', name: 'A' }, { id: 'b', name: 'B' },
        { id: 'c', name: 'C' }, { id: 'd', name: 'D' }
    ];

    it('counts the remainder against what is known, never against the world', () => {
        const known = theSetAsThisCultivatorKnowsIt({
            members: four,
            gates: {
                isPresent: id => id === 'a' || id === 'd',
                // 'd' is standing right there and has never been heard of, so
                // they are a stranger in the square rather than a member of a
                // set the player named.
                hasHeardOf: id => id === 'a' || id === 'b' || id === 'c'
            },
            presenceIsItsOwnDiscovery: false
        });

        expect(known.reached.map(one => one.id)).toEqual(['a']);
        expect(known.heardOfAndNotHere.map(one => one.id)).toEqual(['b', 'c']);
        // The world holds four. Nothing anywhere in the answer says so.
        expect(JSON.stringify(known)).not.toContain('"d"');
    });

    it('makes presence its own discovery for the square, and only there', () => {
        const known = theSetAsThisCultivatorKnowsIt({
            members: four,
            gates: { isPresent: () => true, hasHeardOf: () => false },
            presenceIsItsOwnDiscovery: true
        });
        expect(known.reached).toHaveLength(4);
        expect(known.heardOfAndNotHere).toHaveLength(0);
    });
});

describe('what the report may say', () => {
    const set = theSetThisNames('his family')!;

    /**
     * The law this whole file exists for. Nothing is said, and in particular
     * neither "that was all of them" nor "there are others" - both of those are
     * the world's census arriving in a sentence about a killing.
     */
    it('says nothing at all when the player knows of no others', () => {
        expect(whatTheActDidNotReach(set, [{ id: 'a', name: 'A' }], [])).toBeNull();
    });

    it('names what it could not reach, and does not read as a refusal', () => {
        const said = whatTheActDidNotReach(
            set,
            [{ id: 'a', name: 'Duan Lieshi' }],
            [{ id: 'b', name: 'Duan Wanhe' }, { id: 'c', name: 'Duan Suiya' }]
        )!;

        expect(said).toContain('Duan Wanhe');
        expect(said).toContain('Duan Suiya');
        // Three, which is what the player knows of - not the size of the family.
        expect(said).toMatch(/know of 3/);
        expect(said).not.toMatch(/cannot|not allowed|refuse|may not/i);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// PLAYED, ON A PINNED WORLD
// ─────────────────────────────────────────────────────────────────────────

/**
 * Somebody who can finish the people in front of them without a contest.
 *
 * A set-act played from Qi Condensation Layer 1 correctly stops at the first
 * person who can fight back - a fight is played, not reported - so it measures
 * the loop's stopping rule rather than its completion. Arranging a rung that
 * settles every exchange is what makes completion visible, and it is exactly
 * what the admin surface exists for: a precondition, never a result.
 */
function standAtTheTopOfTheLadder(db: any, id: string): void {
    db.prepare('UPDATE cultivators SET realm_ordinal = 40, hp = 9000, max_hp = 9000 WHERE id = ?')
        .run(id);
}

describe('an act aimed at a set, played', () => {
    it('completes over the square rather than resolving to one person', async () => {
        const { db, game } = await makeGameInWorld({ seed: 'p-a', worldSeed: 'w-a' });
        const { cultivator } = await game.newRun('Brawler');
        await game.act('I look around');
        standAtTheTopOfTheLadder(db, cultivator.id);

        const before = (game as any).present((game as any).currentRun().cultivator).length;
        expect(before).toBeGreaterThan(2);

        const result = await game.act('I kill everyone here');
        const after = (game as any).present((game as any).currentRun().cultivator).length;

        // The measured defect was ONE person considered. What is asserted is
        // that the set was carried out over the reachable subset, which is what
        // the ruling asks for; the exact body count is the resolver's.
        expect(after).toBeLessThan(before - 1);
        expect(result.toolCalls.some(call => call.name === 'engine.actOverASet')).toBe(true);
    }, 120000);

    /**
     * The partly-reachable case, on a house rather than on a family.
     *
     * A house because a family cannot produce one on turn one, which is itself
     * a finding: `applyHouseholds` puts a household in ONE place - *"a
     * household is people who live together"* - so across nine seeded worlds
     * every living kin tie of anybody standing in the square was also standing
     * in the square. A `kin_of` remainder needs a world that has since moved
     * somebody. A house is split by construction, so the same mechanism is
     * measured on the shape that can show it today.
     *
     * `w-b`, Willow Village, The Weir Office: eleven members, three of them
     * here. The player is taught the three who are here and TWO of the eight
     * who are not, so the other six are in neither half of the answer - which
     * is the whole claim, since the world's own figure is eleven and the report
     * must say five.
     */
    it('names the members it did not reach, and only the ones the player knows', async () => {
        const { db, game } = await makeGameInWorld({ seed: 'p-b', worldSeed: 'w-b' });
        const { cultivator } = await game.newRun('Brawler');
        await game.act('I look around');
        standAtTheTopOfTheLadder(db, cultivator.id);

        const service = game as any;
        const world = await game.loadWorld();
        const house = world!.factions.find((row: any) => row.id === 'sect-weir-office')!;
        const members = npcsInFaction(world!, house.id);
        const here = new Set(service.present(service.currentRun().cultivator)
            .map((row: any) => row.id));
        const standing = members.filter(one => here.has(one.id));
        const elsewhere = members.filter(one => !here.has(one.id));
        expect(standing.length).toBe(3);
        expect(elsewhere.length).toBeGreaterThan(4);

        const told = [...standing, elsewhere[0]!, elsewhere[1]!];
        const neverHeardOf = elsewhere.slice(2);
        for (const face of told) {
            service.knowledge.learnIfNew({
                holderId: cultivator.id,
                kind: 'cultivator',
                id: face.id,
                name: face.name,
                onDay: 0,
                sourceKind: 'told',
                sourceNote: 'Somebody said who they were.',
                stance: 'knows',
                statement: `${face.name} exists.`,
                confidence: 1
            });
        }
        service.knowledge.learnIfNew({
            holderId: cultivator.id,
            kind: 'sect',
            id: house.id,
            name: house.name,
            onDay: 0,
            sourceKind: 'told',
            sourceNote: 'Somebody said the name.',
            stance: 'knows',
            statement: `${house.name} exists.`,
            confidence: 1
        });

        const result = await game.act(`I kill all of ${house.name}`);
        const prose = result.narration;

        // Five, which is what this cultivator knows of. The world holds eleven
        // and no sentence anywhere says so.
        expect(prose).toMatch(/know of 5 of/);
        expect(prose).toContain(elsewhere[0]!.name);
        expect(prose).toContain(elsewhere[1]!.name);
        for (const stranger of neverHeardOf) {
            expect(prose, stranger.name).not.toContain(stranger.name);
        }
        expect(prose).not.toMatch(/cannot|not allowed|refuse/i);

        // The ones out of reach live, and it is reach rather than a ruling.
        const still = await game.loadWorld();
        for (const away of elsewhere) {
            expect(still!.npcs.find((npc: any) => npc.id === away.id)!.status).not.toMatch(/dead/);
        }
    }, 120000);

    /**
     * And the correction that matters most: knowing of nobody else is being
     * told nothing.
     *
     * The same square, the same act, with only the person in front of the
     * player known to them. The turn must not say how many there were, must not
     * say that was all of them, and must not say there are more.
     */
    it('says nothing about a remainder when the player knows of no others', async () => {
        const { db, game } = await makeGameInWorld({ seed: 'p-f', worldSeed: 'w-f' });
        const { cultivator } = await game.newRun('Brawler');
        await game.act('I look around');
        standAtTheTopOfTheLadder(db, cultivator.id);

        const service = game as any;
        const world = await game.loadWorld();
        const anchor = world!.npcs.find((npc: any) => npc.id === 'npc-154')!;
        service.knowledge.learnIfNew({
            holderId: cultivator.id,
            kind: 'cultivator',
            id: anchor.id,
            name: anchor.name,
            onDay: 0,
            sourceKind: 'told',
            sourceNote: 'Somebody said who they were.',
            stance: 'knows',
            statement: `${anchor.name} exists.`,
            confidence: 1
        });

        // `kill` rather than the ruling's own `exterminate`, which needs a
        // vocabulary addition in `verb-pattern-table.ts` - a file another agent
        // holds. `the-words-for-killing-more-than-one.test.ts` covers that half
        // and travels with it.
        const result = await game.act(`I kill ${anchor.name}'s family`);

        // Not vacuous: the act ran and the one person they could name is dead.
        expect(result.toolCalls.some(call => call.name === 'engine.actOverASet')).toBe(true);
        const now = await game.loadWorld();
        expect(now!.npcs.find((npc: any) => npc.id === anchor.id)!.status).toMatch(/dead/);

        expect(result.narration).not.toMatch(/you know of/i);
        expect(result.narration).not.toMatch(/were not,? and where they are/i);
        // The parent exists and was never mentioned, which is the whole claim.
        const parent = world!.npcs.find((npc: any) => npc.id === 'npc-168')!;
        expect(result.narration).not.toContain(parent.name);
    }, 120000);
});
