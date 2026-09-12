/**
 * A beast past the change, stood up in a room full of people.
 *
 * THE QUESTION THE DESIGN OWNER ASKED: *"does it talk like someone who knows
 * nothing about the world?"* - which is a prose failure, and in this engine a
 * prose failure is never fixed by telling the narrator to write it better. So
 * what is pinned here is the two things the engine owes the narrator, and
 * nothing about the prose:
 *
 *   WHAT THEY KNOW   read off `knowledge_records`, which is held per person and
 *                    is not the player's privilege. Nothing is written to say
 *                    they are ignorant of a house - `unaware` is what no row
 *                    reads as, for everybody, about almost everything.
 *
 *   HOW THEY DEAL    derived from the species row - ability axis, vein
 *                    relation, disposition, group size, nature - and stored
 *                    nowhere at all.
 *
 * The two are independent, which is the whole point of testing them crossed:
 * a blunt thing that cannot name a house and a careful one that cannot name a
 * house are two different scenes out of the same missing row.
 *
 * NO MODEL RUNS HERE. Every assertion is on the deterministic channel.
 */

import { describe, it, expect } from 'vitest';
import { makeGame } from './harness';
import {
    howThisOneDealsWithPeople,
    theSpeciesTheyMeant,
    whatThisHouseKnowsOf,
    whatTheyDoAboutANameTheyDoNotHave,
    whatTheyHaveARecordFor,
    whyThisOneIsNotSomebody,
    worksOnThePersonRatherThanTheTerms
} from '../../src/engine/world/a-beast-that-took-a-shape-is-somebody';
import { BEAST_CHANGE_ORDINAL } from '../../src/data/cultivation/beasts';

async function withAdmin<T>(fn: () => Promise<T>): Promise<T> {
    const before = process.env.ADMIN_MODE;
    process.env.ADMIN_MODE = 'true';
    try {
        return await fn();
    } finally {
        if (before === undefined) delete process.env.ADMIN_MODE;
        else process.env.ADMIN_MODE = before;
    }
}

describe('what makes somebody somebody is `speaks`, never the rung', () => {
    it('refuses the things above the change that say nothing', () => {
        // The floor-not-iff rule from the schema, which exists because the
        // catalog's worst entries stand above 29 and have nothing to negotiate
        // with. Reading the ordinal instead would turn one into a conversation.
        const sealed = theSpeciesTheyMeant('thing-under-nine-peaks');
        expect(sealed).not.toBeNull();
        expect(sealed!.ordinal).toBeGreaterThan(BEAST_CHANGE_ORDINAL);
        expect(whyThisOneIsNotSomebody(sealed!)).toMatch(/does not speak/);
    });

    it('refuses an animal, and says which line it is under', () => {
        const hawk = theSpeciesTheyMeant('thunder-hawk');
        expect(whyThisOneIsNotSomebody(hawk!)).toMatch(/It is an animal/);
    });

    it('lets the three that took a shape through', () => {
        for (const one of ['fox', 'ape', 'seam']) {
            const found = theSpeciesTheyMeant(one);
            expect(found, one).not.toBeNull();
            expect(whyThisOneIsNotSomebody(found!), one).toBeNull();
        }
    });
});

describe('the manner is read off the species row and two species do not agree', () => {
    // If this ever passes because a table keyed on `beast.id` was added, it has
    // stopped testing anything. What it is for is that five columns already in
    // the catalog carry a manner, so a new species gets one for free.
    const fox = theSpeciesTheyMeant('nine-tailed-reader')!;
    const seam = theSpeciesTheyMeant('seam')!;
    const ape = theSpeciesTheyMeant('white-ape')!;

    it('gives each of them five statements', () => {
        for (const one of [fox, seam, ape]) {
            expect(howThisOneDealsWithPeople(one)).toHaveLength(5);
        }
    });

    it('differs exactly where the rows differ, and agrees exactly where they agree', () => {
        // THIS IS THE ASSERTION THAT PROVES IT IS DERIVED. The fox and the
        // seam share two columns - both `neutral`, both solitary - and
        // differ on three: breath against defence, indifferent against holds,
        // and open-world against sealed. So exactly two statements match. An
        // authored table would have no reason to line up that way, and a first
        // cut of this test demanded all five differ and was simply wrong.
        expect(fox.disposition).toBe(seam.disposition);
        expect(fox.groupSize).toBe(seam.groupSize);
        expect(fox.ability.kind).not.toBe(seam.ability.kind);
        expect(fox.veinRelation).not.toBe(seam.veinRelation);

        const theirs = new Set(howThisOneDealsWithPeople(fox));
        const shared = howThisOneDealsWithPeople(seam).filter(line => theirs.has(line));
        expect(shared).toHaveLength(2);

        // And where a column does differ, so does the statement: the ape keeps
        // terms and the fox prices them, off `disposition` alone.
        expect(ape.disposition).not.toBe(fox.disposition);
        const apes = new Set(howThisOneDealsWithPeople(ape));
        // Two again, and for different columns: these two are both solitary
        // and both `intelligent`, and they part on terms, on ground and on
        // what they reach for.
        expect(howThisOneDealsWithPeople(fox).filter(l => apes.has(l))).toHaveLength(2);
        expect(howThisOneDealsWithPeople(ape).join(' '))
            .not.toMatch(/prices everything/);
    });

    it('reads what it does about terms off the disposition column', () => {
        // The ape keeps arrangements, the fox prices things. Both come off the
        // houses' own three-way axis and neither is authored for a species.
        expect(howThisOneDealsWithPeople(ape).join(' ')).toMatch(/keeps terms it agreed to/);
        expect(howThisOneDealsWithPeople(fox).join(' ')).toMatch(/prices everything/);
    });

    it('reads the trope off three columns, not off a species name', () => {
        // There is no `seeming` ability axis - the fox's is `breath`, which it
        // shares with a marsh ambush predator - so this is keyed on wanting
        // nothing from the ground, being dealable-with, and having lived where
        // people are. One occupant today, which is a fact about the catalog.
        expect(worksOnThePersonRatherThanTheTerms(fox)).toBe(true);
        expect(worksOnThePersonRatherThanTheTerms(seam)).toBe(false);
        expect(worksOnThePersonRatherThanTheTerms(ape)).toBe(false);
        const serpent = theSpeciesTheyMeant('mist-serpent')!;
        expect(serpent.ability.kind).toBe(fox.ability.kind);
        expect(worksOnThePersonRatherThanTheTerms(serpent)).toBe(false);

        const manner = howThisOneDealsWithPeople(fox).join(' ');
        expect(manner).toMatch(/works on whoever is in front of it rather than on the terms/);
        expect(manner).toMatch(/being welcome is the thing it reaches for/);
        // Conduct, never a label and never a body.
        expect(manner).not.toMatch(/seductive|alluring|beautiful|charming|flirt/i);
    });

    it('forks what they do about a name they have not got, off the same three columns', () => {
        // `beasts.ts`: the absence shows twice - not knowing when at ease, and
        // inventing badly when trying. Which half shows is not a second field.
        expect(whatTheyDoAboutANameTheyDoNotHave(fox))
            .toMatch(/Does not say that it has not heard of it/);
        expect(whatTheyDoAboutANameTheyDoNotHave(seam))
            .toMatch(/Says so, once/);
    });

    it('says a solitary thing has never had to agree with anybody', () => {
        expect(howThisOneDealsWithPeople(fox).join(' '))
            .toMatch(/never in its life had to agree/);
    });
});

describe('what they have a record for is read, never asserted', () => {
    it('says nothing at all when every stage came back held', () => {
        const read = whatTheyHaveARecordFor([
            { kind: 'sect', name: 'A House', stage: 'known' }
        ]);
        expect(read.none).toEqual([]);
        expect(read.lines).toEqual(['A House: known.']);
    });

    it('says the names have never been said in front of them, not that they forgot', () => {
        const read = whatTheyHaveARecordFor([
            { kind: 'sect', name: 'A House', stage: 'unaware' },
            { kind: 'sect', name: 'Another House', stage: 'unaware' }
        ]);
        expect(read.lines[0]).toMatch(/never said in front of them/);
        expect(read.lines[0]).toMatch(/^Has never heard any of the names/);
        // The distinction the design owner drew: not knowing is a fact,
        // confusion is characterisation and belongs to the narrator.
        expect(read.lines[0]).not.toMatch(/confus|naive|simple|foolish/i);
    });
});

describe('a house knows what its people know and carries no record of its own', () => {
    it('is unaware when nobody on the roll has heard of them', () => {
        const read = whatThisHouseKnowsOf({
            roll: [{ id: 'a', rankIndex: 0 }, { id: 'b', rankIndex: 6 }],
            rankCount: 7,
            stageFor: () => 'unaware'
        });
        expect(read.anybody).toBe('unaware');
        expect(read.whoCarriesIt).toBeNull();
    });

    it('separates having heard at all from being able to act on it', () => {
        // An outer disciple hearing a rumour IS the house having heard of it.
        // It is not the house being able to do anything about it, and those
        // two states are most of what a player is manoeuvring in.
        const read = whatThisHouseKnowsOf({
            roll: [{ id: 'outer', rankIndex: 0 }, { id: 'head', rankIndex: 6 }],
            rankCount: 7,
            stageFor: id => (id === 'outer' ? 'whisper' : 'unaware')
        });
        expect(read.anybody).toBe('whisper');
        expect(read.whoCarriesIt).toBe('outer');
        expect(read.deciders).toBe('unaware');
    });
});

describe('ADMIN stands one up, in the room the player is standing in', () => {
    it('takes the rung off the catalog and will not go below the change', async () => {
        await withAdmin(async () => {
            const { game } = makeGame({ adminMode: true, seed: 'took-a-shape-1' });
            await game.newRun('Shen Yuan');

            const spawned = await game.act('ADMIN spawn_encounter species=fox');
            expect(spawned.narration).toMatch(/encounter spawned/i);
            expect(spawned.narration).toMatch(/The Reader at Burnt Earth/);
            // Its own rung, unasked for.
            expect(spawned.narration).toMatch(/Void Tribulation/i);

            // And an ordinal below the change does not make an animal of it:
            // what makes it somebody is the change, so the floor holds.
            const low = await game.act('ADMIN spawn_encounter species=seam ordinal=4');
            expect(low.narration).not.toMatch(/Qi Condensation/i);
        }, 60_000);
    }, 60_000);

    it('refuses a species that never took a shape, and names the ones that did', async () => {
        await withAdmin(async () => {
            const { game } = makeGame({ adminMode: true, seed: 'took-a-shape-2' });
            await game.newRun('Shen Yuan');
            const refused = await game.act('ADMIN spawn_encounter species=millennial-tortoise');
            expect(refused.narration).toMatch(/does not speak/);
            expect(refused.narration).toMatch(/The Reader at Burnt Earth/);
        }, 60_000);
    }, 60_000);

    it('emits both axes, and no row was written to say it is ignorant', async () => {
        await withAdmin(async () => {
            const { game, db } = makeGame({ adminMode: true, seed: 'took-a-shape-3' });
            await game.newRun('Shen Yuan');
            const spawned = await game.act('ADMIN spawn_encounter species=fox');

            expect(spawned.narration).toMatch(/HOW THEY DEAL/);
            expect(spawned.narration).toMatch(/WHAT THEY HAVE A RECORD FOR/);
            expect(spawned.narration).toMatch(/prices everything/);

            // THE WHOLE DESIGN, ASSERTED AS A COUNT. Exactly one row was
            // written for this person and it is what they can see: the player,
            // standing in front of them. Nothing was written about a house,
            // because `unaware` is what an absent row reads as and a spawn that
            // seeded institutions would be authoring a biography.
            const rows = db.prepare(`
                SELECT claim_key FROM knowledge_records
                WHERE holder_id = (
                    SELECT id FROM cultivators WHERE name = 'The Reader at Burnt Earth' LIMIT 1
                )
            `).all() as Array<{ claim_key: string }>;
            expect(rows).toHaveLength(1);
            expect(rows[0].claim_key).toMatch(/^exists:cultivator:/);
            expect(rows.filter(r => r.claim_key.startsWith('exists:sect:'))).toEqual([]);
        }, 60_000);
    }, 60_000);

    it('can be spoken to by the name the game printed', async () => {
        // FOUND BY PLAYING. `I ask The Reader at Burnt Earth which house she is
        // from` was answered by a village girl standing nearby, about a topic
        // called "The Reader at Burnt Earth" - so every fact the engine held
        // about her was unreachable, which is worse than any of them being
        // wrong. `parseAsk` takes the leading article off the query and the
        // stored name keeps it, so `matchScore`'s prefix rule could not fire.
        // Not a beast bug: any name beginning with "The", asked about in a
        // sentence with no `about` in it. See `matchScore`.
        await withAdmin(async () => {
            const { game } = makeGame({ adminMode: true, seed: 'took-a-shape-5' });
            await game.newRun('Shen Yuan');
            await game.act('ADMIN spawn_encounter ordinal=4 name=Tang Xuxue disposition=friendly');
            await game.act('ADMIN spawn_encounter species=fox');

            const byName = await game.act(
                'I ask The Reader at Burnt Earth which house she is from');
            expect(byName.narration).toMatch(/^The Reader at Burnt Earth/);
            expect(byName.narration).not.toMatch(/Tang Xuxue/);

            // And the pronoun, which follows whoever was last dealt with.
            const byPronoun = await game.act('I ask her about her house');
            expect(byPronoun.narration).toMatch(/The Reader at Burnt Earth/);
        });
    }, 60_000);

    it('runs in an eating house, a sect compound and a traveller\'s inn', async () => {
        // THE THREE SETTINGS ARE THREE POPULATIONS, not three location kinds.
        // What changes between them is which institutions are standing in the
        // room, and that is what the reader is keyed on - so a sect compound
        // asks about the house whose compound it is and an eating house asks
        // about whoever happens to be eating in it.
        await withAdmin(async () => {
            const { game } = makeGame({ adminMode: true, seed: 'took-a-shape-4' });
            await game.newRun('Shen Yuan');

            // A compound: people on a house's roll, standing here.
            await game.act('ADMIN spawn_encounter ordinal=30 alignment=righteous name=Gate Elder');
            await game.act('ADMIN spawn_encounter ordinal=6 alignment=righteous name=Outer Disciple');

            const spawned = await game.act('ADMIN spawn_encounter species=seam');
            expect(spawned.narration).toMatch(/knows of them: unaware/);
            expect(spawned.narration).toMatch(/Has never heard (the name|any of the names)/);
            // The depth half, off the rung rather than off a field.
            expect(spawned.narration).toMatch(/Reads the ground here completely/);
        }, 60_000);
    }, 60_000);
});
