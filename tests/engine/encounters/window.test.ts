/**
 * What a life actually contains, measured.
 *
 * The rate assertions are BANDS rather than exact figures, and the band is the
 * design claim: an ordinary year holds several things, a twenty-year seclusion
 * is interrupted about once, a sealed door holds. If a change moves one of
 * these out of its band, that is a design decision and should be argued for in
 * `README.md` rather than fixed by widening the band.
 */

import { describe, expect, it } from 'vitest';
import { requireEncounter } from '../../../src/data/cultivation/encounters.js';
import {
    rollEncounters,
    stanceFor,
    type EncounterActivity,
    type EncounterOccurrence,
    type EncounterPerson,
    type EncounterPlace,
    type EncounterRollInput
} from '../../../src/engine/encounters/index.js';

const village: EncounterPlace = { id: 'v', name: 'Burnt Earth', kind: 'settlement', danger: 0.2, qiDensity: 12 };
const road: EncounterPlace = { id: 'r', name: 'the low road', kind: 'wilds', danger: 0.45, qiDensity: 20 };
const cave: EncounterPlace = { id: 'c', name: 'a cave above Burnt Earth', kind: 'cave', danger: 0.3, qiDensity: 30 };

function who(ordinal: number, fortune = 1) {
    return { id: 'c1', realmOrdinal: ordinal, fortune, maxHp: 60, hp: 60, spiritStones: 40 };
}

/** A year of play: forty turns, spread across what a life is spent doing. */
function playYear(seed: string, ordinal: number, fromDay: number, fortune = 1): EncounterOccurrence[] {
    const cycle: EncounterActivity[] = ['travel', 'abroad', 'gathering', 'labour'];
    const out: EncounterOccurrence[] = [];
    for (let turn = 0; turn < 40; turn++) {
        const activity = cycle[turn % cycle.length];
        out.push(...rollEncounters({
            seed,
            startDay: fromDay + turn,
            days: 1,
            activity,
            cultivator: who(ordinal, fortune),
            place: activity === 'abroad' || activity === 'labour' ? village : road
        }).occurrences);
    }
    return out;
}

describe('a year of ordinary life', () => {
    it('holds several things, in both directions', () => {
        for (const ordinal of [0, 8, 20, 34]) {
            const years = 25;
            const all: EncounterOccurrence[] = [];
            for (let y = 0; y < years; y++) all.push(...playYear('life', ordinal, y * 40));

            const perYear = all.length / years;
            expect(perYear, `ordinal ${ordinal}: too quiet`).toBeGreaterThan(3);
            expect(perYear, `ordinal ${ordinal}: too busy`).toBeLessThan(9);

            const good = all.filter(o => o.valence === 'good').length;
            const bad = all.filter(o => o.valence === 'bad').length;
            expect(good / all.length, `ordinal ${ordinal}: the world never gives`).toBeGreaterThan(0.2);
            expect(bad / all.length, `ordinal ${ordinal}: the world never takes`).toBeGreaterThan(0.2);
        }
    });

    it('draws from the whole catalog rather than a handful of rows', () => {
        const all: EncounterOccurrence[] = [];
        for (let y = 0; y < 25; y++) all.push(...playYear('variety', 8, y * 40));
        const distinct = new Set(all.map(o => o.entryId));
        expect(distinct.size).toBeGreaterThan(25);
    });

    it('hands control back sometimes and settles the rest itself', () => {
        const all: EncounterOccurrence[] = [];
        for (let y = 0; y < 25; y++) all.push(...playYear('control', 8, y * 40));
        const interrupting = all.filter(o => o.interrupts).length;
        expect(interrupting).toBeGreaterThan(0);
        expect(interrupting).toBeLessThan(all.length);

        // An interruption is a decision point, so the engine must not also have
        // helped itself to the outcome.
        for (const o of all) {
            if (!o.interrupts) continue;
            expect(o.deltas).toEqual({ hp: 0, spiritStones: 0, satiety: 0, rations: 0 });
        }
    });

    it('never kills anybody with something it settled on its own', () => {
        const all: EncounterOccurrence[] = [];
        for (let y = 0; y < 25; y++) all.push(...playYear('lethal', 8, y * 40));
        for (const o of all) expect(o.deltas.hp).toBeGreaterThan(-60);
    });
});

describe('seclusion', () => {
    const world = Array.from({ length: 140 }, (_, i) => ({
        factId: `f${i}`,
        day: 0,
        text: 'Something happened and nobody is saying whose doing it was.',
        magnitude: i % 10 === 0 ? 0.75 : i % 4 === 0 ? 0.5 : 0.35
    }));

    function twentyYears(seed: string, ordinal = 12) {
        return rollEncounters({
            seed,
            startDay: 400,
            days: 20 * 360,
            activity: 'seclusion',
            cultivator: who(ordinal),
            place: cave,
            limit: 32,
            arrivable: world
        });
    }

    it('is not a black box', () => {
        let withSomething = 0;
        let interrupted = 0;
        const trials = 40;
        for (let s = 0; s < trials; s++) {
            const roll = twentyYears(`sec-${s}`);
            if (roll.occurrences.length > 0) withSomething++;
            if (roll.firstInterruptDay !== null) interrupted++;
        }
        // Twenty years alone in a cave and nothing at all found you is the old
        // behaviour and is what this module exists to end.
        expect(withSomething / trials).toBeGreaterThan(0.8);
        expect(interrupted / trials).toBeGreaterThan(0.6);
    });

    it('does not cut a long seclusion down to nothing', () => {
        const firsts: number[] = [];
        for (let s = 0; s < 40; s++) {
            const roll = twentyYears(`len-${s}`);
            if (roll.firstInterruptDay !== null) firsts.push((roll.firstInterruptDay - 400) / 360);
        }
        const mean = firsts.reduce((a, b) => a + b, 0) / firsts.length;
        // Interrupted around the middle: a decade of seclusion is still a
        // decade, and it is no longer twenty years of nothing.
        expect(mean).toBeGreaterThan(4);
        expect(mean).toBeLessThan(14);
    });

    it('lets the world arrive as well as the catalog', () => {
        let arrivals = 0;
        for (let s = 0; s < 40; s++) {
            arrivals += twentyYears(`arr-${s}`).occurrences.filter(o => o.source === 'digest').length;
        }
        expect(arrivals).toBeGreaterThan(0);
    });

    it('reports the sealed hall it did not walk to, rather than stopping for it', () => {
        // The door rule, end to end: over many decades of seclusion, some
        // non-interrupting ruin entries turn up and none of them stops the sit.
        const reported: EncounterOccurrence[] = [];
        for (let s = 0; s < 60; s++) {
            reported.push(...twentyYears(`door-${s}`).occurrences.filter(o => !o.interrupts));
        }
        expect(reported.length).toBeGreaterThan(0);
        for (const o of reported) expect(o.interrupts).toBe(false);
    });
});

describe('the sealed door', () => {
    /**
     * It holds against nearly everything, which is a bargain worth paying for
     * and is not the same as immunity. A war crossing the valley outside is
     * exactly the case where the door is load-bearing and not absolute.
     */
    const forty = (seed: string, activity: 'sealed' | 'seclusion') => rollEncounters({
        seed,
        startDay: 0,
        days: 40 * 360,
        activity,
        cultivator: who(10),
        place: cave,
        arrivable: [{ factId: 'f', day: 10, text: 'A war crossed the valley.', magnitude: 0.95 }]
    });

    it('holds against nearly everything, which is the bargain it was sold as', () => {
        const seeds = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
        const sealed = seeds.reduce((n, s) => n + forty(s, 'sealed').occurrences.length, 0);
        const open = seeds.reduce((n, s) => n + forty(s, 'seclusion').occurrences.length, 0);

        expect(open, 'an open cave over forty years should see plenty').toBeGreaterThan(0);
        expect(sealed, 'the door should stop the large majority of it')
            .toBeLessThan(open / 2);
    });

    it('is a door rather than a ward, over a long enough seclusion', () => {
        // Forty years, ten seeds. If this ever goes back to zero across all of
        // them, sealing has silently become the dominant strategy again.
        const everReached = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']
            .some(s => forty(s, 'sealed').firstInterruptDay !== null);
        expect(everReached, 'four centuries of sealed cave-years and nobody ever got in')
            .toBe(true);
    });
});

describe('determinism', () => {
    const base: EncounterRollInput = {
        seed: 'fixed-seed',
        startDay: 733,
        days: 3600,
        activity: 'seclusion',
        cultivator: who(11),
        place: cave,
        arrivable: [
            { factId: 'f1', day: 900, text: 'A road was shut and stayed shut.', magnitude: 0.7 },
            { factId: 'f2', day: 1400, text: 'A village came off the rolls.', magnitude: 0.4 }
        ]
    };

    it('is a pure function of seed and state', () => {
        expect(rollEncounters(base)).toEqual(rollEncounters(base));
    });

    it('gives a different life to a different seed', () => {
        const other = rollEncounters({ ...base, seed: 'other-seed' });
        expect(JSON.stringify(other)).not.toEqual(JSON.stringify(rollEncounters(base)));
    });

    it('keys every roll to the absolute day, so a window can be re-cut', () => {
        // The property the truncation wiring depends on. Splitting a window at
        // its first interruption and rolling the remainder must give the same
        // days the whole window would have given.
        const whole = rollEncounters({ ...base, days: 7200 });
        expect(whole.firstInterruptDay).not.toBeNull();

        const spent = whole.firstInterruptDay! - base.startDay;
        const remainder = rollEncounters({
            ...base,
            startDay: whole.firstInterruptDay!,
            days: 7200 - spent
        });
        // Same starting point, same seed, same everything -> same first answer.
        const again = rollEncounters({
            ...base,
            startDay: whole.firstInterruptDay!,
            days: 7200 - spent
        });
        expect(remainder).toEqual(again);
    });
});

describe('fortune', () => {
    function tally(fortune: number) {
        let missed = 0;
        let passed = 0;
        let total = 0;
        for (let t = 0; t < 4000; t++) {
            for (const o of rollEncounters({
                seed: 'fortune',
                startDay: t,
                days: 1,
                activity: 'gathering',
                cultivator: who(8, fortune),
                place: road
            }).occurrences) {
                total++;
                if (o.event.data.outcome === 'missed') missed++;
                if (o.event.data.outcome === 'passed_by') passed++;
            }
        }
        return { missed, passed, total };
    }

    it('moves timing and availability and nothing else', () => {
        const unlucky = tally(0);
        const blessed = tally(3);

        // The same number of things happen. Fortune never manufactures a
        // branch - it decides whether you got there first.
        expect(Math.abs(blessed.total - unlucky.total)).toBeLessThan(unlucky.total * 0.05);
        expect(blessed.missed).toBeLessThan(unlucky.missed);
        expect(blessed.passed).toBeGreaterThan(unlucky.passed);
    });
});

describe('what stands above', () => {
    it('does not fight the player, and is not explained', () => {
        // A cultivator at the bottom, drawing for long enough to meet something
        // pitched a long way up. The engine must price it as unengageable
        // rather than as a fight that was lost.
        const seen: EncounterOccurrence[] = [];
        for (let t = 0; t < 6000; t++) {
            seen.push(...rollEncounters({
                seed: 'above',
                startDay: t,
                days: 1,
                activity: 'travel',
                cultivator: who(6),
                place: road
            }).occurrences);
        }
        const above = seen.filter(o => o.stance === 'above' && o.event.data.outcome === 'landed');
        expect(above.length).toBeGreaterThan(0);
        for (const o of above) {
            expect(o.confrontation).not.toBeNull();
            expect(o.confrontation!.threatOrdinal - 6).toBeGreaterThanOrEqual(4);
            expect(o.event.summary).toContain('They were not what any of it was about.');
        }
    });

    it('is priced off the gap and nothing else', () => {
        // Unit rather than population, because `beneath` is currently
        // unreachable through the play draw: the catalog's `minOrdinal` and
        // `threatOrdinal` move together, so the rank narrowing culls an entry
        // as outgrown before the draw ever gets as far as pricing its fight.
        // That is coherent - the world stops offering you what you have
        // outgrown - and it is asserted here rather than in a sample so that
        // the empty band is not mistaken for a broken one. See README.md.
        const bandit = requireEncounter('enc-roadside-bandits');
        expect(stanceFor(bandit, 'unreachable')).toBe('above');
        expect(stanceFor(bandit, 'overmatched')).toBe('above');
        expect(stanceFor(bandit, 'matched')).toBe('engaged');
        expect(stanceFor(bandit, 'beneath')).toBe('beneath');
        expect(stanceFor(bandit, 'dismissed')).toBe('beneath');

        const noFight = requireEncounter('enc-untouched-herb-patch');
        expect(stanceFor(noFight, 'matched')).toBe('none');
    });
});

describe('the people seam', () => {
    const crowd: EncounterPerson[] = [
        { id: 'npc-1', name: 'Jiang Ciyi', realmOrdinal: 11, factionName: 'Thousand Treasure Pavilion', rank: 'Clerk' },
        { id: 'npc-2', name: 'Gu Huilu', realmOrdinal: 12 },
        { id: 'npc-3', name: 'Shen Anbo', realmOrdinal: 7, known: true }
    ];

    function withCrowd(seed: string, cast: EncounterPerson[]) {
        const out: EncounterOccurrence[] = [];
        for (let t = 0; t < 900; t++) {
            out.push(...rollEncounters({
                seed,
                startDay: t,
                days: 1,
                activity: 'abroad',
                cultivator: who(10),
                place: village,
                cast
            }).occurrences);
        }
        return out;
    }

    it('promotes somebody out of the crowd when an encounter needs a person', () => {
        const all = withCrowd('cast', crowd);
        const grants = all.flatMap(o => o.grants).filter(g => g.kind === 'cultivator');
        expect(grants.length).toBeGreaterThan(0);
        for (const g of grants) {
            expect(crowd.map(p => p.id)).toContain(g.id);
            expect(g.sourceKind).toBe('witnessed');
            expect(g.stance).toBe('knows');
        }
    });

    it('never grants somebody the player already knows', () => {
        const all = withCrowd('cast', crowd);
        for (const g of all.flatMap(o => o.grants)) expect(g.id).not.toBe('npc-3');
    });

    it('names nobody when the place is empty', () => {
        const all = withCrowd('empty', []);
        expect(all.length).toBeGreaterThan(0);
        expect(all.flatMap(o => o.grants).filter(g => g.kind === 'cultivator')).toHaveLength(0);
        // And it does not fall over: a person-shaped slot becomes a person-free
        // fact rather than an invented cultivator.
        for (const o of all) expect(o.event.summary).not.toContain('{name}');
    });
});

describe('the discovery rule', () => {
    const factions = [
        { id: 'sect-a', name: 'The Lantern Hall' },
        { id: 'sect-b', name: 'Ninefold Silent Cliffs', known: true }
    ];

    it('says an unheard name only when a person said it, and records that they did', () => {
        const all: EncounterOccurrence[] = [];
        for (let t = 0; t < 3000; t++) {
            all.push(...rollEncounters({
                seed: 'names',
                startDay: t,
                days: 1,
                activity: 'abroad',
                cultivator: who(10),
                place: village,
                names: { factions }
            }).occurrences);
        }

        const unknown = 'The Lantern Hall';
        const said = all.filter(o => o.event.summary.includes(unknown));
        expect(said.length, 'the unheard name never surfaced at all').toBeGreaterThan(0);

        for (const o of said) {
            const granted = o.grants.some(g => g.id === 'sect-a');
            expect(granted, `${o.entryId} named an unheard body without a source`).toBe(true);
        }

        // And the grant is honest about what it is worth: a word, from somebody
        // who did not explain it.
        for (const g of all.flatMap(o => o.grants).filter(g => g.kind === 'sect')) {
            expect(g.stance).toBe('suspects');
            expect(g.statement).toContain('What it is remains unknown');
        }
    });

    it('leaves no token unfilled in anything it hands a narrator', () => {
        const all: EncounterOccurrence[] = [];
        for (const activity of ['travel', 'abroad', 'gathering', 'labour', 'convalescence', 'seclusion'] as EncounterActivity[]) {
            for (let t = 0; t < 1200; t++) {
                all.push(...rollEncounters({
                    seed: 'tokens',
                    startDay: t,
                    days: 1,
                    activity,
                    cultivator: who(t % 40),
                    place: activity === 'seclusion' ? cave : village,
                    names: { factions, herbs: ['spirit lotus'], pills: ['a foundation pill'], techniques: ['a sword method'] }
                }).occurrences);
            }
        }
        expect(all.length).toBeGreaterThan(50);
        for (const o of all) {
            expect(o.event.summary, `${o.entryId} left a token unfilled`).not.toMatch(/\{[a-zA-Z]+\}/u);
        }
    });
});
