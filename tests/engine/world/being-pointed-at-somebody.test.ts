/**
 * Somebody who does not have the thing, telling you who does.
 *
 * FOUND BY PLAYING, and it is structural rather than a missing verb. Measured
 * across the asking layer: **no answer in this game could name a third party
 * the player had not already heard of.** Everything a question answers from
 * goes through `resolveAnything`, filtered by the ASKER's knowledge gate before
 * the person answering is consulted at all, and third-party names inside the
 * result are collapsed to a count unless the player could already name them.
 * The one channel that did hand over a new proper noun draws off a lore table
 * keyed on the speaker's rung and is blind to the topic.
 *
 * So a person could be asked where to learn an art, know exactly who teaches
 * it, and structurally not be able to say.
 *
 * The design owner: *"you have to know SOMETHING, else the game is just dead."*
 * *"You can imagine an elder telling you the patriarch teaches technique x.
 * EVEN IF THEY DON'T HAVE IT."* And on the first cut, which only handled arts:
 * *"remember this is pointing you at ANYTHING they know. That's the non-bespoke
 * case."*
 *
 * `whoWouldAsk` predicted the gap in its own comment long before this existed:
 * the house roll was left out *"only because nothing hands this method a
 * curriculum - not because they would not know it."*
 */

import { describe, it, expect } from 'vitest';

import {
    whoTheyCouldPointYouAt,
    whatTheyCouldPlaceForYou,
    whatTheySayAboutWhoHoldsIt,
    howTheyComeToKnowIt
} from '../../../src/engine/world/who-they-could-point-you-at';

const HOUSE = 'sect-azure-cloud-pavilion';
const OTHER = 'sect-iron-tally-court';
const ART = 'tech-azure-cloud-step';

const npc = (id: string, over: Partial<{
    faction: string | null; rank: number; ordinal: number; arts: string[]; status: string;
}> = {}) => ({
    id,
    name: id,
    status: over.status ?? 'alive',
    factionId: over.faction === undefined ? HOUSE : over.faction,
    factionRankIndex: over.rank ?? 1,
    cultivation: { realmOrdinal: over.ordinal ?? 10, techniqueIds: over.arts ?? [] }
});

const pointing = (npcs: unknown[], over: Partial<{ faction: string | null }> = {}) =>
    whoTheyCouldPointYouAt({
        speakerId: 'npc-elder',
        speakerFactionId: over.faction === undefined ? HOUSE : over.faction,
        hereIds: new Set(['npc-elder', 'player']),
        artId: ART,
        exclude: new Set(['player']),
        npcs: npcs as never
    });

describe('an elder naming the patriarch', () => {
    it('names somebody on their own roll who holds it, though they do not', () => {
        const found = pointing([
            npc('npc-patriarch', { rank: 9, ordinal: 30, arts: [ART] }),
            npc('npc-elder', { rank: 5, ordinal: 20 })
        ]);
        expect(found?.id).toBe('npc-patriarch');
        expect(found?.because).toBe('on their own roll');
        // And the sentence says the whole of it: not theirs, and whose.
        expect(whatTheySayAboutWhoHoldsIt(found!, 'Azure Cloud Step'))
            .toMatch(/do not hold Azure Cloud Step\. npc-patriarch does/);
    });

    it('names the most senior holder, because that is who anybody names', () => {
        const found = pointing([
            npc('npc-junior', { rank: 1, ordinal: 12, arts: [ART] }),
            npc('npc-patriarch', { rank: 9, ordinal: 30, arts: [ART] })
        ]);
        expect(found?.id).toBe('npc-patriarch');
    });

    it('prefers their own roll over a stranger standing here', () => {
        const found = whoTheyCouldPointYouAt({
            speakerId: 'npc-elder',
            speakerFactionId: HOUSE,
            hereIds: new Set(['npc-elder', 'npc-visitor']),
            artId: ART,
            exclude: new Set(),
            npcs: [
                npc('npc-visitor', { faction: OTHER, rank: 9, ordinal: 40, arts: [ART] }),
                npc('npc-own', { rank: 2, ordinal: 14, arts: [ART] })
            ] as never
        });
        expect(found?.id).toBe('npc-own');
        expect(found?.because).toBe('on their own roll');
    });

    /**
     * AND THE GATE STILL HOLDS, which is what makes this safe to ship. A
     * pointer names somebody the player could not name a moment ago, so the
     * SPEAKER has to be in a position to know it. A stranger in a market cannot
     * point at the patriarch of a house across the province.
     */
    it('says nothing about somebody the speaker has no way of knowing', () => {
        expect(pointing([
            npc('npc-far-away', { faction: OTHER, rank: 9, ordinal: 40, arts: [ART] })
        ])).toBeNull();
        // Nor when the speaker belongs to nobody and the holder is elsewhere.
        expect(pointing([
            npc('npc-far-away', { faction: OTHER, rank: 9, ordinal: 40, arts: [ART] })
        ], { faction: null })).toBeNull();
    });

    it('says nothing when nobody they could know holds it, and shrugs honestly', () => {
        expect(pointing([npc('npc-patriarch', { rank: 9, arts: ['tech-something-else'] })]))
            .toBeNull();
    });

    it('does not point at the dead, or at the asker, or at itself', () => {
        expect(pointing([npc('npc-gone', { rank: 9, arts: [ART], status: 'dead' })])).toBeNull();
        expect(pointing([npc('player', { rank: 9, arts: [ART] })])).toBeNull();
        expect(pointing([npc('npc-elder', { rank: 9, arts: [ART] })])).toBeNull();
    });
});

/**
 * AND THE SAME RULE FOR ANYTHING ELSE, which is the non-bespoke form. One
 * predicate over whatever the topic named, and no branch per question.
 */
describe('anything else they can place', () => {
    const placing = (
        subject: { id: string; name: string; kind: 'cultivator' | 'sect' | 'place' },
        over: Partial<{
            here: string[]; roll: string[]; faction: string | null; hereName: string;
        }> = {}
    ) => whatTheyCouldPlaceForYou({
        subject,
        speakerId: 'npc-elder',
        speakerFactionId: over.faction === undefined ? HOUSE : over.faction,
        speakerFactionName: 'Azure Cloud Pavilion',
        hereName: over.hereName ?? 'Cloud Gate',
        hereIds: new Set(over.here ?? ['npc-elder']),
        ownRollIds: new Set(over.roll ?? [])
    });

    it('places a person on their own roll, and one standing here', () => {
        const own = placing(
            { id: 'npc-x', name: 'Xue Songyi', kind: 'cultivator' },
            { roll: ['npc-x'] }
        );
        expect(own?.because).toBe('on their own roll');
        expect(howTheyComeToKnowIt(own!)).toMatch(/on the same roll they are/);

        const seen = placing(
            { id: 'npc-y', name: 'Yin Cuo', kind: 'cultivator' },
            { here: ['npc-elder', 'npc-y'] }
        );
        expect(seen?.because).toBe('standing right here');
    });

    it('places their own house and the ground under them, and nothing else', () => {
        expect(placing({ id: HOUSE, name: 'Azure Cloud Pavilion', kind: 'sect' })?.because)
            .toBe('their own house');
        expect(placing({ id: OTHER, name: 'Iron Tally Court', kind: 'sect' })).toBeNull();

        expect(placing({ id: 'loc-cloud-gate', name: 'Cloud Gate', kind: 'place' })?.because)
            .toBe('the ground they are standing on');
        expect(placing({ id: 'loc-far', name: 'The Drowned Sea', kind: 'place' })).toBeNull();
    });

    it('never places a person the speaker has no line to', () => {
        expect(placing({ id: 'npc-stranger', name: 'Somebody', kind: 'cultivator' })).toBeNull();
    });
});
