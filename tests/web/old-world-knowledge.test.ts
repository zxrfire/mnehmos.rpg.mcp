/**
 * The lore rows existed only in catalog tests. Asking could name no subject for them,
 * and recall had no learned statement to read. The live question must disclose a short
 * fact from an appropriate holder, preserve its source, and withhold private records
 * from strangers. Reading an archive requires standing in that archive; neither a
 * remembered topic nor a distant room grants a new fact.
 */
import { getSect } from '../../src/data/cultivation/sects.js';

import { describe, expect, it } from 'vitest';
import {
    whatSomebodyKnowsOfTheOldWorld, oldWorldArchive, oldWorldYear
} from '../../src/web/what-somebody-knows-of-the-old-world.js';
import { parseIntent } from '../../src/web/actions.js';
import { PRESENT_YEAR, THE_CALENDAR_OFFSET, CALENDARS } from '../../src/data/cultivation/history.js';
import { FALSE_IMMORTAL_ORDINAL } from '../../src/engine/cultivation/realms.js';
import { purposeOf } from '../../src/engine/world/architecture.js';
import { makeGame, makeGameInWorld } from './harness.js';

const philosopher = { realmOrdinal: FALSE_IMMORTAL_ORDINAL, sectId: null };
const reading = (topic: string, sectId: string | null = null) =>
    whatSomebodyKnowsOfTheOldWorld(topic, { ...philosopher, sectId }, PRESENT_YEAR)!;

describe('facts about the old world', () => {
    it.each([
        ['nodes and seams', 'house-immovable-mountain', /same work/],
        ['reconciliation', 'house-immovable-mountain', /bodies of law/],
        ['sect archives', null, /stipend rolls/],
        ['calendar offset', 'house-immovable-mountain', /survey notes/],
        ['calendar offset', 'house-ninefold-karma', /unpublished inheritance/],
        ['offset hides', 'house-immovable-mountain', /Nine Stone Array/],
        ['offset hides', 'house-ninefold-karma', /settled estates/],
        ['offset hides', 'house-shrinking-earth', /tradition war/],
        ['first cultivators', 'house-immovable-mountain', /incompatible evidence/],
        ['the Lid', 'house-shrinking-earth', /origin and holder are unknown/],
        ['abandoned arts', null, /lawful/],
        ['ancient art upkeep', null, /patron's stores/],
        ['modern and ancient arts', null, /alter categories/],
        ['longevity flower extinction', 'sect-hollow-court', /both sides/],
        ['ruin medicine', null, /grants.*years/],
        ['medicine trade', null, /not guaranteed/],
        ['resting chamber', null, /wakes its occupant/],
        ['ruins and caves', null, /halls, wards/],
        ['trial gates', null, /particular past event/],
        ['closed ground access', null, /survival floor/i],
        ['closed ground', null, /intact inheritances/],
        ['sealed ancestors', null, /still alive/],
        ['waking window', null, /people who remain/],
        ['can an apex die', null, /title supplies no immunity/],
        ['the Empyrean Court could face an apex', 'sect-hollow-court', /work on the crossing/],
        ['revolt', null, /authority they would be ending/],
        ['who holds a key', null, /Tribulation Transcendence/],
        ['why is the head pinned', null, /Separating the holder/i],
        ['identifying a seat', 'sect-myriad-course-hall', /signature art/],
        ['candidate register', 'sect-earth-vein-tower', /no entry establishes/i],
        ['false immortal dao', null, /does not cap comprehension/],
        ['false immortal protectors', null, /posts remain open/],
        ['Court guest protector', 'sect-hollow-court', /no formal appointment/],
        ['attestation', null, /ceremony alone/]
    ] as const)('answers %s from its record', (topic, house, claim) => {
        const answer = reading(topic, house);
        expect(answer.holdsIt).toBe(true);
        const said = answer.subject.facts.join(' ');
        expect(said).toMatch(claim);
        expect(said).not.toMatch(/AGENTS|\.ts|engine|narrator|whatItIsForInPlay|ordinal/i);
        for (const line of answer.subject.facts) expect(line.length).toBeLessThan(500);
    });

    it('does not give a village elder the Lid, or a senior stranger a private record', () => {
        const village = whatSomebodyKnowsOfTheOldWorld('the Lid', { realmOrdinal: 0, sectId: null }, PRESENT_YEAR)!;
        expect(village.holdsIt).toBe(false);
        expect(village.subject.facts).toEqual([]);
        expect(reading('the Lid', 'sect-azure-dew').subject.facts).toEqual([]);
        expect(reading('candidate register').subject.facts).toEqual([]);
        const temple = reading('offset hides', 'house-immovable-mountain').subject.facts.join(' ');
        expect(temple).not.toMatch(/unpublished offset|settled estates/);
        expect(reading('present count').subject.facts.join(' ')).not.toMatch(/guest|appointment|Lu Sheng/);
    });

    it('uses the commercial value without treating it as a verified reconciliation', () => {
        const said = reading('calendar offset').subject.facts.join(' ');
        expect(said).toContain(`offset of ${THE_CALENDAR_OFFSET.commercialYears} years`);
        expect(said).toContain('no shared dated event verifies it');
        expect(said).not.toMatch(/survey notes|unpublished inheritance/);
        expect(CALENDARS.find(c => c.id === 'calendar-face-years')!.presentYear)
            .toBe(PRESENT_YEAR - THE_CALENDAR_OFFSET.commercialYears);
    });

    it('does not put another house’s unpublished record on a shelf', () => {
        const ordinary = oldWorldArchive('sect-azure-dew-sect', PRESENT_YEAR, getSect('sect-azure-dew-sect')!.powerOrdinal).flatMap(row => [...row.lines]).join(' ');
        expect(ordinary).toMatch(/intake registers/);
        expect(ordinary).not.toMatch(/carved seams|boundary's substance|unpublished inheritance|signature art/);
        const temple = oldWorldArchive('house-immovable-mountain', PRESENT_YEAR, getSect('house-immovable-mountain')!.powerOrdinal).flatMap(row => [...row.lines]).join(' ');
        expect(temple).toMatch(/same work at different scales/);
        expect(temple).not.toMatch(/unpublished inheritance/);
        const court = oldWorldArchive('sect-hollow-court', PRESENT_YEAR,
            getSect('sect-hollow-court')!.powerOrdinal).flatMap(row => [...row.lines]).join(' ');
        expect(court).not.toMatch(/no formal appointment|guest holds no seat/);
    });
});

describe('asking, remembering and reading in play', () => {
    it('learns a factual answer from somebody nearby and recalls that answer with its source', async () => {
        const { game, repos, db } = makeGame({ seed: 'lore-question' });
        try {
            const { cultivator } = await game.newRun('Aspirant');
            const npc = repos.cultivators.create({ ...cultivator, id: 'npc-lore-reader', name: 'Record Reader',
                kind: 'npc', realmOrdinal: 29, sectId: null });
            const result = await game.act(`I ask ${npc.name} about ancient arts`);
            expect(result.toolCalls.some(call => call.name === 'engine.askedAbout')).toBe(true);
            expect(result.narration).toMatch(/alter categories/);
            const held = game.knowledge.awareness(cultivator.id, 'event').find(row => /alter categories/.test(row.statement));
            expect(held?.sourceKind).toBe('told');
            expect(held?.sourceNote).toContain(npc.name);
            const recalled = await game.act('What do I know about modern and ancient arts?');
            expect(recalled.narration).toMatch(/alter categories/);
            expect(recalled.narration).toContain(npc.name);
            const hidden = await game.act('What do I know about the candidate register?');
            expect(hidden.narration).not.toMatch(/lists of possible returned/);
        } finally { db.close(); }
    });

    it('reads only the archive underfoot, and the running era supplies dates across runs', async () => {
        const { game, repos, db } = await makeGameInWorld({ seed: 'lore-archive', worldSeed: 'lore-archive-world' });
        try {
            const { cultivator } = await game.newRun('Aspirant');
            expect(parseIntent('I read the archive')).toMatchObject({ action: 'look', intent: 'history', target: 'archive' });
            const remote = await game.act('I read the archive');
            expect(remote.toolCalls.some(call => call.name === 'knowledge.archive' && !call.ok)).toBe(true);
            expect(game.knowledge.awareness(cultivator.id, 'event').some(row => row.sourceKind === 'read')).toBe(false);
            const world = game.atHand!;
            const archive = world.locations.find(location => purposeOf(location) === 'archive')!;
            expect(archive).toBeDefined();
            repos.cultivators.update(cultivator.id, { location: archive.name });
            const read = await game.act('I read the archive');
            expect(read.toolCalls.some(call => call.name === 'knowledge.archive' && call.ok)).toBe(true);
            expect(read.narration).toMatch(/stipend rolls/);
            expect(game.knowledge.awareness(cultivator.id, 'event').some(row => row.sourceKind === 'read')).toBe(true);
            const before = oldWorldYear(world, 0);
            world.currentDay += 365 * 7;
            expect(oldWorldYear(world, 0)).toBe(before + 7);
        } finally { db.close(); }
    }, 120_000);
});
