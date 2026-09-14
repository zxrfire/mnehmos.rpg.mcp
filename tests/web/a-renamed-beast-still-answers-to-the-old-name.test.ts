/**
 * A BEAST THAT TOOK A PERSON'S NAME STILL ANSWERS TO THE ONE THE PLAYER HOLDS.
 *
 * `theNamesThisOneAnswersTo` has returned both names for as long as the crossing
 * at `BEAST_CHANGE_ORDINAL` has renamed anybody, and nothing could ask it.
 * `resolveCultivator` scored a typed word against `row.name` alone, and its
 * candidates come off `repos.cultivators.roster()` and `KnowledgeScope.present`,
 * neither of which carried the `beast:` tag the species half is derived from. So
 * a player who was told `Thunder Hawk` forty years ago, and holds a knowledge
 * row saying `Thunder Hawk`, typed it at the individual standing in front of
 * them and reached nobody. The gap was written down in the module's own header
 * as wiring rather than design, and this is the wiring.
 *
 * The design owner, asked which name wins: *"it might answer to its old name but
 * it prefers this one."* So both resolve, and the game addresses them by the
 * person's name in either case - which is what the second assertion in each
 * arm is for. Preference here is not about which row is found (there is one
 * row, and its id never changed at the crossing); it is about what the engine
 * then calls them.
 *
 * NOTHING IS STORED FOR ANY OF IT. The species name is a function of the tag,
 * so the two names cannot drift and no write can forget one.
 *
 * RED-CHECKED. Scoring `row => row.name` in `resolveCultivator` fails the old
 * name arm; dropping `tags` from `worldRosterRow` fails it the same way.
 */

import { describe, expect, it } from 'vitest';

import { makeGame } from './harness';
import { KnowledgeGate } from '../../src/web/knowledge';
import { resolveCultivator } from '../../src/web/entities';
import { worldRosterRow } from '../../src/web/view';
import { BEASTS, anythingAtThisRungSpeaks } from '../../src/data/cultivation/beasts';
import { hasACore } from '../../src/engine/world/hunting-a-spirit-beast';
import {
    standUpTheOneOnThisGround,
    theNameItTookAtTheChange,
    theNamesThisOneAnswersTo
} from '../../src/engine/world/a-beast-with-a-core-is-somebody-in-particular';
import { setRealm } from '../../src/engine/world/npc-state';
import { MAX_ORDINAL } from '../../src/engine/cultivation/realms';

const SEED = 'a-renamed-beast';
const GROUND = 'loc-a-ledge-somebody-walked-onto';
const DAY = 365 * 1_000;

/** The lowest rung at which anything speaks, read off the predicate. */
const THE_CHANGE = (() => {
    for (let ordinal = 0; ordinal <= MAX_ORDINAL; ordinal++) {
        if (anythingAtThisRungSpeaks(ordinal)) return ordinal;
    }
    throw new Error('nothing on the ladder speaks');
})();

/**
 * One met below the change, so it is minted under its species name, then moved
 * past it the way the world moves anybody. Read out of the catalog rather than
 * written down here: if no species is placed between the core and the change
 * the trope has nothing to happen to, and that is the finding.
 */
function theOneOnTheLedge() {
    const species = BEASTS.find(beast => hasACore(beast) && !anythingAtThisRungSpeaks(beast.ordinal));
    expect(species, 'no species in the catalog is met below the change with a core').toBeTruthy();

    const met = standUpTheOneOnThisGround({
        beast: species!, locationId: GROUND, seed: SEED, onDay: DAY
    });
    expect(met.name, 'it was not minted under the name the player would be told')
        .toBe(species!.name);

    const crossed = setRealm(met, THE_CHANGE, DAY);
    const took = theNameItTookAtTheChange(crossed, SEED);
    expect(took, 'nothing was rolled at the change').toBeTruthy();
    return { species: species!, npc: { ...crossed, name: took! }, took: took! };
}

describe('the name a player was told keeps reaching the individual', () => {
    it('answers to the species it was met as, and to the name it took', () => {
        const { species, npc, took } = theOneOnTheLedge();
        const { db, repos } = makeGame({ seed: SEED });
        try {
            const scope = {
                gate: new KnowledgeGate(db),
                holderId: 'the-player',
                here: GROUND,
                present: [worldRosterRow(npc, DAY)]
            };

            // The name they hold, from the day they met an animal.
            const byTheOldName = resolveCultivator(repos, species.name, 'the-player', scope);
            expect(byTheOldName, 'the name the player was told reached nobody').not.toBeNull();
            expect(byTheOldName!.id).toBe(npc.id);
            // AND IT PREFERS THE OTHER ONE. Reached by the species, addressed as
            // the person - which is the whole of the ruling.
            expect(byTheOldName!.name).toBe(took);

            // And the name it took, which is the one everybody uses now.
            const byTheNewName = resolveCultivator(repos, took, 'the-player', scope);
            expect(byTheNewName, 'the name it took reached nobody').not.toBeNull();
            expect(byTheNewName!.id).toBe(npc.id);
            expect(byTheNewName!.name).toBe(took);
        } finally {
            db.close();
        }
    });

    it('is the same set of names the engine already derived, and nothing was stored for it', () => {
        const { species, npc, took } = theOneOnTheLedge();
        expect(theNamesThisOneAnswersTo(npc).sort()).toEqual([species.name, took].sort());
        // The tag is the whole of what the row carries. A second name column
        // would be the store this was built to avoid.
        expect(worldRosterRow(npc, DAY).tags).toEqual(npc.tags);
    });

    it('leaves an ordinary person answering to one name', () => {
        const { db, repos } = makeGame({ seed: SEED });
        try {
            const { npc } = theOneOnTheLedge();
            const person = { ...npc, tags: npc.tags.filter(tag => !tag.startsWith('beast:')) };
            const scope = {
                gate: new KnowledgeGate(db),
                holderId: 'the-player',
                here: GROUND,
                present: [worldRosterRow(person, DAY)]
            };
            const species = BEASTS.find(b => hasACore(b) && !anythingAtThisRungSpeaks(b.ordinal))!;
            expect(resolveCultivator(repos, species.name, 'the-player', scope)).toBeNull();
            expect(resolveCultivator(repos, person.name, 'the-player', scope)).not.toBeNull();
        } finally {
            db.close();
        }
    });
});
