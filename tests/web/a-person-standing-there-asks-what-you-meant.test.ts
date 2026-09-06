/**
 * A sentence the engine cannot place is answered by a person, not by a report.
 *
 * `what-somebody-here-would-ask.ts` was written, compiled and had no caller
 * anywhere in `src/` - every artefact of a finished feature except the one that
 * matters. What a unit test over the module cannot say is whether anybody
 * typing into the game ever reaches it, so this is played.
 *
 * Two properties, and the second is the one the module exists for:
 *
 *   - somebody standing there asks what you meant, rather than the narrator
 *     reporting that the thought did not resolve;
 *   - every name that comes back is a name that person could place. Their
 *     knowledge is derived from two world facts - the square in front of them
 *     and their own house's roll - and an engine reading its own catalog out
 *     loud in somebody's mouth would be indistinguishable in the prose.
 *
 * ── WHERE A BARE NAME ACTUALLY LANDS ─────────────────────────────────────
 *
 * Measured while writing this, and it decided how the two call sites are
 * wired: a name typed on its own reaches no verb at all. `Yan Shuling`,
 * `elder yun of the weir` and `The Grand Sword Elder` all route to `unclear`, not to
 * the name resolver. So the design owner's own example - asking for a name
 * nobody here holds - arrives at the branch that used to answer "the thought
 * does not resolve", and wiring only the resolver's blank look would have left
 * the flagship case exactly where it was.
 */

import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';

import { makeGame, makeGameInWorld } from './harness';
import { KnowledgeGate } from '../../src/web/knowledge';
import { MEMBERS, getMembersOf } from '../../src/data/cultivation/members';
import { whatSomebodyHereWouldAsk } from '../../src/web/what-somebody-here-would-ask';

const WORLD = 'somebody-here-would-ask-world';
const RUN = 'somebody-here-would-ask';

/** The module's signature: a person answering, in their own mouth. */
// The prose is kind-agnostic since the read stopped being about names only:
// a person can fail to place a house, a place or a thing, and can fail on a
// WORD, which is the branch that asks what you mean by it.
const A_PERSON_ANSWERED = /does not know it|does not follow/;

/** A word nobody in this world is called, for the half of a name that misses. */
const NOBODY_IS_CALLED_THIS = 'Qixuanzhe';

/**
 * Every person in the world whose name turns up in an answer.
 *
 * The corpus is the whole authored catalog plus whoever is standing here, so a
 * name offered out of a house the asker does not serve - which is how this
 * fails - is caught rather than assumed absent.
 */
function peopleNamedIn(said: string, alsoHere: readonly string[]): string[] {
    const everybody = new Set<string>([...MEMBERS.map(member => member.name), ...alsoHere]);
    return [...everybody].filter(name => said.includes(name));
}

/**
 * A square holding one person who serves a house with a roll on it.
 *
 * Built rather than found: what is being measured is whether the asker's OWN
 * house reaches the answer, and a world that happens to seat a lone unaffiliated
 * villager in the opening square can only ever exercise the other branch.
 */
async function aSquareWithSomebodyWhoServesAHouse() {
    const harness = makeGame({ seed: 'a-house-behind-the-person-asking' });
    const { cultivator } = await harness.game.newRun('Probe');
    const where = harness.repos.cultivators.getById(cultivator.id)!.location;

    const onTheRoll = new Map<string, number>();
    for (const member of MEMBERS) {
        onTheRoll.set(member.factionId, (onTheRoll.get(member.factionId) ?? 0) + 1);
    }
    const sectId = [...onTheRoll.entries()]
        .filter(([id]) => harness.repos.sects.getById(id) !== null)
        .sort((a, b) => b[1] - a[1])[0]![0];

    // A NAME NO CATALOG PERSON SHARES A WORD WITH. `matchScore` scores a shared
    // word, so an asker whose surname turns up on their own house's roll would
    // make the two branches below indistinguishable - the offer and the "you
    // mean me?" would both be live and only the ordering would decide.
    const wordsOnTheRolls = new Set(
        MEMBERS.flatMap(member => member.name.toLowerCase().split(/\s+/))
    );
    const unused = (word: string): string => {
        let tried = word;
        while (wordsOnTheRolls.has(tried.toLowerCase())) tried += 'e';
        return tried;
    };
    const askerName = `${unused('Zhuo')} ${unused('Weilan')}`;
    const askerId = randomUUID();
    harness.repos.cultivators.create({
        id: askerId, name: askerName, kind: 'npc',
        spiritRoot: 'single_water', sex: 'female', physique: null,
        attributes: { might: 1, insight: 2, fortune: 1, charm: 2 },
        realmOrdinal: 0, cultivationProgress: 0,
        hp: 30, maxHp: 30, qi: 10, maxQi: 10, age: 19,
        location: where, sectId, alive: true
    } as never);

    // Standing in front of somebody is how the player comes to be able to name
    // them, and the refusal names the asker - so this is played rather than
    // written into the knowledge table.
    await harness.game.act(`I examine ${askerName}`);

    const gate = new KnowledgeGate(harness.db);
    expect(gate.isAwareOf(cultivator.id, 'cultivator', askerId)).toBe(true);

    const roll = getMembersOf(sectId);
    // Somebody on the roll who is NOT here and who the player has never heard
    // of. If their name comes back, it came off the house and nowhere else.
    const target = roll.find(member =>
        member.name.split(' ').length === 2
        && !member.name.startsWith(askerName.split(' ')[0]!)
        && !gate.isAwareOf(cultivator.id, 'cultivator', member.id))!;

    return {
        ...harness,
        cultivator,
        gate,
        askerName,
        target,
        canPlace: new Set<string>([askerName, ...roll.map(member => member.name)])
    };
}

describe('a name nobody here holds is answered off the asker\'s own house roll', () => {
    it('offers somebody on their roll the player has never heard of', async () => {
        const { game, gate, cultivator, askerName, target, canPlace } =
            await aSquareWithSomebodyWhoServesAHouse();

        // Half the name right, which is the band this read serves: it scores
        // under the resolver's bar and over nothing at all.
        const surname = target.name.split(' ')[0];
        const answer = await game.act(`${surname} ${NOBODY_IS_CALLED_THIS}`) as
            { narration: string };

        expect(answer.narration).toContain(askerName);
        expect(answer.narration).toMatch(A_PERSON_ANSWERED);

        const offered = peopleNamedIn(answer.narration, [askerName]);
        expect(offered.length).toBeGreaterThan(0);
        for (const name of offered) {
            expect(canPlace.has(name), `${name} was offered and the asker could not place them`)
                .toBe(true);
        }

        // AND IT IS NOT A MIRROR. Every name offered is somebody the player
        // could not have been handed by their own knowledge, which is the whole
        // difference between this and the read it replaced.
        const byName = new Map(getMembersOf(
            game.present(cultivator)[0]!.sectId!
        ).map(member => [member.name, member.id]));
        for (const name of offered) {
            const id = byName.get(name);
            if (id === undefined) continue;
            expect(gate.isAwareOf(cultivator.id, 'cultivator', id)).toBe(false);
        }
    });

    it('answers a name inside a sentence the same way', async () => {
        const { game, askerName, target, canPlace } =
            await aSquareWithSomebodyWhoServesAHouse();

        const surname = target.name.split(' ')[0];
        const answer = await game.act(`I talk to ${surname} ${NOBODY_IS_CALLED_THIS}`) as
            { narration: string };

        expect(answer.narration).toContain(askerName);
        expect(answer.narration).toMatch(A_PERSON_ANSWERED);
        for (const name of peopleNamedIn(answer.narration, [askerName])) {
            expect(canPlace.has(name), `${name} was offered and the asker could not place them`)
                .toBe(true);
        }
    });

    it('wonders whether you meant them, when the name half-fits the person in front of you',
        async () => {
            const { game, askerName } = await aSquareWithSomebodyWhoServesAHouse();

            const answer = await game.act(
                `I talk to ${askerName.split(' ')[0]} ${NOBODY_IS_CALLED_THIS}`
            ) as { narration: string };

            // A person can always place themselves, and this is the commonest
            // miss there is: one word of a two-word name right.
            expect(answer.narration).toMatch(/wonders whether you meant them/);
        });
});

describe('and it reaches a real square in a real world', () => {
    it('has somebody standing there ask, and names nobody they could not place', async () => {
        const harness = await makeGameInWorld({ seed: RUN, worldSeed: WORLD });
        const { cultivator } = await harness.game.newRun('Probe');
        const gate = new KnowledgeGate(harness.db);

        const here = harness.game.present(cultivator);
        const asker = here.find(row => gate.isAwareOf(cultivator.id, 'cultivator', row.id));
        expect(asker, 'this world put nobody nameable in the opening square').toBeDefined();

        const canPlace = new Set<string>([
            ...here.map(row => row.name),
            ...(asker!.sectId ? getMembersOf(asker!.sectId).map(m => m.name) : [])
        ]);

        for (const said of [
            `I talk to ${asker!.name.split(' ')[0]} ${NOBODY_IS_CALLED_THIS}`,
            'I do the thing with the thing'
        ]) {
            const answer = await harness.game.act(said) as { narration: string };
            expect(answer.narration, said).toContain(asker!.name);
            for (const name of peopleNamedIn(answer.narration, here.map(row => row.name))) {
                if (name === cultivator.name) continue;
                expect(canPlace.has(name), `${said}: ${name} could not be placed by anybody here`)
                    .toBe(true);
            }
        }
    }, 300_000);

    it('keeps the list of what is live, which is a different useful thing', async () => {
        const harness = await makeGameInWorld({ seed: `${RUN}-list`, worldSeed: WORLD });
        await harness.game.newRun('Probe');

        const answer = await harness.game.act('I do the thing with the thing') as
            { narration: string };
        expect(answer.narration)
            .toMatch(/does not resolve into anything you could actually do/i);
        expect(answer.narration).toContain('Things that would, at this moment');
    }, 300_000);
});

describe('nobody offers a name when there is nobody to offer one', () => {
    it('leaves a name that reached nobody to the empty square', async () => {
        const { game } = makeGame({ seed: 'alone-when-a-name-misses' });
        const { cultivator } = await game.newRun('Probe');
        expect(game.present(cultivator)).toEqual([]);

        const answer = await game.act(`I talk to Lin ${NOBODY_IS_CALLED_THIS}`) as
            { narration: string };

        expect(answer.narration).not.toMatch(A_PERSON_ANSWERED);
        expect(peopleNamedIn(answer.narration, [])).toEqual([]);
    });

    it('leaves the sentence that reached no verb alone as well', async () => {
        const { game } = makeGame({ seed: 'alone-when-nothing-reaches' });
        const { cultivator } = await game.newRun('Probe');
        expect(game.present(cultivator)).toEqual([]);

        const answer = await game.act('I do the thing with the thing') as { narration: string };

        expect(answer.narration)
            .toMatch(/does not resolve into anything you could actually do/i);
        expect(answer.narration).not.toMatch(A_PERSON_ANSWERED);
        expect(peopleNamedIn(answer.narration, [])).toEqual([]);
    });
});

describe('and it is not only names', () => {
    /**
     * The design owner, correcting a first cut that only handled people: *this
     * isn't only limited to names of course, it could be anything.* A house, a
     * place, a thing in somebody's hand - and a WORD, which is the case with no
     * candidate at all.
     */
    const asker = { id: 'asker', name: 'Shen Yuan' };
    const likeness = (said: string, name: string) =>
        name.toLowerCase().includes(said.toLowerCase().trim()) ? 1 : 0;

    it('offers a house when a house is what came nearest', () => {
        const asked = whatSomebodyHereWouldAsk({
            askedFor: 'hollow',
            asker,
            theyCanPlace: {
                inFrontOfThem: [
                    { id: 'sect-hollow-court', name: 'The Hollow Court', kind: 'house' }
                ],
                ownHouseWouldKnow: []
            },
            likeness
        });
        expect(asked.offered).toEqual(['The Hollow Court']);
        expect(asked.said, 'the words say which KIND it is offering')
            .toContain('which house you meant');
    });

    /**
     * "I end the Hollow Court" is a sentence whose VERB is the unclear part.
     * There is no candidate of any kind, and the answer is the one a person
     * gives: what do you mean by that.
     */
    it('asks what you mean by it when nothing of any kind is a candidate', () => {
        const asked = whatSomebodyHereWouldAsk({
            askedFor: 'end',
            asker,
            theyCanPlace: {
                inFrontOfThem: [{ id: 'b', name: 'Lu Wan', kind: 'person' }],
                ownHouseWouldKnow: []
            },
            likeness
        });
        expect(asked.offered).toEqual([]);
        expect(asked.said).toContain('what you mean by it');
        expect(asked.said, 'and it still says what IS here').toContain('Lu Wan');
    });

    /** Nothing offered is ever something the asker could not place. */
    it('never offers a thing it was not handed', () => {
        const asked = whatSomebodyHereWouldAsk({
            askedFor: 'Zhang Wuji',
            asker,
            theyCanPlace: { inFrontOfThem: [], ownHouseWouldKnow: [] },
            likeness
        });
        expect(asked.offered).toEqual([]);
    });
});
