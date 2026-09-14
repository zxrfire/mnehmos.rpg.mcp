/**
 * A hunt that can end in something still breathing.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `hunt` passed `force: 'everything'` to the resolver as a literal, so the one
 * verb named for going out after something could only ever come back with a
 * body. Measured on the reader before this landed:
 *
 *     "I hunt the White Ape of the Gorge"                -> everything
 *     "I hunt the White Ape of the Gorge and take it alive"  -> everything
 *     "I hunt the White Ape of the Gorge, but I do not kill it" -> everything
 *
 * The second and third were not ignored - they were INVERTED. Every phrasing
 * of restraint in English contains `kill`, `kills` or `to kill`, all three of
 * which `EVERYTHING_THEY_HAVE` matches, so a sentence saying the killing would
 * not happen scored the killing. A vocabulary that reads a negation as its own
 * subject has taken a side, which is the failure AGENTS.md names.
 *
 * It matters at the top of the ladder in particular. At `BEAST_CHANGE_ORDINAL`
 * and above the thing on the ground has a shape and a voice, the repo tracks
 * it as a row among the people, `whatSparingThemLeft` writes the favour a
 * spared party owes, and the id survives the crossing - so the account written
 * about an animal is held by the person it becomes. All of that was built and
 * the hunt could not reach any of it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT IS PINNED, AND WHAT IS DELIBERATELY NOT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The bare hunt is still a killing, and that is asserted, because the fix must
 * not quietly make hunting non-lethal - the verb exists for what comes off a
 * body. What is new is only that a sentence which holds short is heard.
 *
 * No rung, figure, species ordinal or place name is pinned. The creature is
 * picked by asking the catalog which entries have a core, and the ladder
 * bounds come from `realms.ts`.
 *
 * RED-CHECKED by restoring the literal swing in `GameService.hunt`: the played
 * arm then reports the ape down and dead, nothing goes onto the yielding flag,
 * and both the sparing and the favour assertions fail. Restoring the old
 * `howMuchWasBehindIt` ordering (killing words above restraint) fails the
 * reader arm on the two negated sentences.
 */

import { describe, it, expect } from 'vitest';

import { makeGameInWorld } from './harness';
import { resetCultivationWorlds } from '../../src/server/state/cultivation-world';
import { parseIntent } from '../../src/web/verb-pattern-table';
import { howTheySaidTheySwung } from '../../src/web/how-they-said-they-swung';
import { theWorstItCouldDo } from '../../src/engine/cultivation/how-a-blow-was-thrown';
import { BEASTS } from '../../src/data/cultivation/beasts';
import { beastsOnThisGround, hasACore } from '../../src/engine/world/hunting-a-spirit-beast';
import { isOnAVein, isSealedOn, whatGroundThisIs }
    from '../../src/engine/world/what-ground-a-place-is';
import { idOfTheOneOnThisGround } from '../../src/engine/world/a-beast-with-a-core-is-somebody-in-particular';
import { MAX_ORDINAL } from '../../src/engine/cultivation/realms';

const read = (turn: { narration?: string | null }): string => turn.narration ?? '';

/**
 * The strongest thing in the catalog that is somebody in particular.
 *
 * Read out of the catalog rather than named, so a species rename or a new
 * entry above this one moves the test with it. The one it finds is what the
 * ruling is about: at the top of the ladder these carry a shape and a voice.
 */
const theOneWithACore = BEASTS
    .filter(hasACore)
    .reduce((a, b) => (b.ordinal > a.ordinal ? b : a));

describe('the reader hears a hunt that is not meant to finish anything', () => {
    it('still means the kill when the sentence says nothing about it', () => {
        const plan = parseIntent(`I hunt the ${theOneWithACore.name}`);
        expect(plan.action, 'the sentence stopped reaching the verb').toBe('hunt');
        expect(plan.thrown?.force, 'a bare hunt stopped being a killing')
            .toBe('everything');
        expect(theWorstItCouldDo(plan.thrown!)).toBe('a_death');
    });

    it.each([
        'and take it alive',
        'but I do not kill it',
        'without killing it'
    ])('hears "%s" as a blow that stops short', tail => {
        const plan = parseIntent(`I hunt the ${theOneWithACore.name} ${tail}`);
        expect(plan.action).toBe('hunt');
        expect(plan.thrown?.force, 'a stated restraint was read as its own opposite')
            .not.toBe('everything');
        expect(
            theWorstItCouldDo(plan.thrown!),
            'the blow could still finish it, so the sentence changed nothing'
        ).not.toBe('a_death');
    });

    /**
     * The bare form belongs to the VERB. Two callers, two defaults, one table
     * of words - a second table would be the drift this repo keeps paying for.
     */
    it('leaves the ordinary swing alone', () => {
        expect(howTheySaidTheySwung('I attack him').force).toBe('committed');
        expect(howTheySaidTheySwung('I kill him').force).toBe('everything');
        expect(howTheySaidTheySwung('I hunt it', 'everything').force).toBe('everything');
    });
});

describe('a hunt can leave something beaten and alive, and it can be let up', () => {
    it('puts what it beat in front of the player, and lets them let it up', async () => {
        resetCultivationWorlds();
        const seed = 'a-hunt-that-spares';
        const { game, db } = await makeGameInWorld({ seed, worldSeed: `world-${seed}` });
        const { cultivator } = await game.newRun('Lin Baoqing');

        const world = (await game.loadWorld())!;
        // THE DEEPEST ONE THIS WORLD COULD ACTUALLY BE STANDING ON, asked of
        // the same function the hunt asks. A cored beast is one animal on one
        // ledge - counted, with a place - so naming it reaches it where it
        // lives and is refused where it does not, and a fixture that stands
        // the player on any rich ground is arranging a situation the game
        // cannot produce.
        //
        // WORTH WRITING DOWN: the catalog's deepest cored species is on NO
        // ground this world generates, so nothing in a played run can reach it
        // at all. That is a finding about the catalog against the map rather
        // than about the hunt, and it is not fixed here.
        let place: (typeof world.locations)[number] | undefined;
        let itsSpecies: typeof theOneWithACore | undefined;
        for (const one of world.locations) {
            const grounds = whatGroundThisIs(world, one);
            const could = beastsOnThisGround({
                sealed: isSealedOn(one, world.currentDay),
                onAVein: isOnAVein(world, one, grounds),
                grounds: grounds ?? undefined
            }).filter(hasACore);
            for (const beast of could) {
                if (!itsSpecies || beast.ordinal > itsSpecies.ordinal) {
                    itsSpecies = beast;
                    place = one;
                }
            }
        }
        expect(place, 'the pinned world has no ground one of these could hold').toBeDefined();
        expect(itsSpecies, 'no cored species can stand anywhere in this world').toBeDefined();

        // ARRANGED FAST, at the top of the ladder, because what is being
        // measured is the ENDING of a fight and not whether it can be won.
        // `docs/admin.md`'s rule: arrange the situation, assert the outcome.
        db.prepare(
            'UPDATE cultivators SET location = ?, realm_ordinal = ?, hp = 9000, max_hp = 9000 '
            + 'WHERE id = ?'
        ).run(place!.name, MAX_ORDINAL, cultivator.id);

        const hunted = read(await game.act(
            `I hunt the ${itsSpecies!.name} and take it alive`
        ));
        expect(hunted, 'the hunt did not reach the one that was named')
            .toContain(itsSpecies!.name);
        // The engine's own statement that the thing is dead, which is what a
        // hunt told to stop short must not be able to produce.
        expect(hunted, 'a hunt told to stop short still came back with a body')
            .not.toContain(`${itsSpecies!.name} is down.`);

        // AND THE SENTENCE ANYBODY WOULD TYPE NEXT. `it` is the only pronoun
        // people use for one of these, and it used to reach nothing at all
        // outside a standing fight.
        const spared = read(await game.act('I spare it'));
        expect(spared, 'letting it up came back as a blank look or a refusal')
            .not.toMatch(/Nobody here is beaten/i);
        expect(spared, 'nothing said that it is alive because of a decision')
            .toMatch(/alive and owes you/i);

        // ── AND THE ACCOUNT IS HELD BY THE ONE STANDING THERE ────────────
        //
        // Against the derived id rather than against a name in the prose: the
        // whole value of the row is that it does not change when the ordinal
        // does, so the favour written about the animal is held by the person.
        const owed = db
            .prepare(
                "SELECT status, kind FROM obligations WHERE holder_id = ? AND subject_id = ?"
            )
            .all(cultivator.id, idOfTheOneOnThisGround(itsSpecies!.id, place!.id)) as
            Array<{ status: string; kind: string }>;
        expect(
            owed.some(row => row.kind === 'favor' && row.status === 'open'),
            'it was let go and owes nobody anything, so the trope has nothing to stand on'
        ).toBe(true);
    }, 180_000);
});
