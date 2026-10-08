/**
 * Root's moving-scene controls proved fresh voyage frames, but reaches only
 * checked activity/tags/sealed: a literal sealed cave mouth remained eligible
 * on water. Current physical placement must constrain that entry, rather than
 * banning every ruin, grave or trader. No seed search or sampled outcome is
 * substituted. The existing original-window control separately protects cadence,
 * RNG streams and complete receipts; these assertions protect the eligible pool.
 * Unknown legacy pure inputs are intentionally not a claim about actual terrain.
 */
import { expect, it } from 'vitest';
import { ENCOUNTERS } from '../../../src/data/cultivation/encounters.js';
import { encounterPool } from '../../../src/engine/encounters/select.js';
import { reaches } from '../../../src/engine/encounters/activity.js';
import type { EncounterPlace } from '../../../src/engine/encounters/types.js';

const water: EncounterPlace = { id: 'current-sea', name: 'Current water', kind: 'region', substrate: 'water' };
const land: EncounterPlace = { ...water, id: 'current-land', name: 'Current land', substrate: 'land' };
const row = (id: string) => ENCOUNTERS.find(entry => entry.id === id)!;

it('requires actual land for literal cave, tomb, field, hall and road infrastructure while allowing them ashore', () => {
    for (const id of ['enc-sealed-cave-mouth', 'enc-abandoned-cave-dwelling', 'enc-sealed-tomb',
        'enc-ploughed-fragments', 'enc-stone-seats-for-two-hundred', 'enc-sealed-hall-of-a-dead-age',
        'enc-roadside-bandits', 'enc-bandit-toll-post', 'enc-caravan-under-attack',
        'enc-old-formation-node-relit', 'enc-robbed-in-seclusion']) {
        const entry = row(id);
        expect(entry).toBeDefined();
        expect(reaches(entry, 'travel', water)).toBe(false);
        expect(reaches(entry, 'travel', land)).toBe(true);
        expect(encounterPool({ ordinal: entry.minOrdinal, activity: 'travel', place: water })
            .some(candidate => candidate.entry.id === id)).toBe(false);
        expect(encounterPool({ ordinal: entry.minOrdinal, activity: 'travel', place: land })
            .some(candidate => candidate.entry.id === id)).toBe(true);
    }
});

it('keeps actual corpse finds, grave contacts, portable ruins, traders and hostile actors eligible afloat', () => {
    for (const id of ['enc-dead-cultivator-pouch', 'enc-grave-recent-death', 'enc-grave-reader-partnership',
        'enc-attention-from-a-robbed-grave', 'enc-manual-in-a-lost-grade', 'enc-travelling-pill-merchant',
        'enc-duel-challenge', 'enc-mist-serpent', 'enc-bandit-cultivator-leader', 'enc-press-gang']) {
        const entry = row(id);
        expect(entry).toBeDefined();
        expect(reaches(entry, 'travel', water)).toBe(true);
        expect(encounterPool({ ordinal: entry.minOrdinal, activity: 'travel', place: water })
            .some(candidate => candidate.entry.id === id)).toBe(true);
    }
});

it('keeps existing exposure and sealed reach rules instead of treating substrate as an override', () => {
    expect(reaches(row('enc-travelling-pill-merchant'), 'sealed', water)).toBe(false);
    expect(reaches(row('enc-travelling-pill-merchant'), 'travel', { ...water, sealed: true })).toBe(false);
    const { substrate: _unknown, ...legacy } = land;
    expect(reaches(row('enc-sealed-cave-mouth'), 'travel', legacy)).toBe(true);
});
