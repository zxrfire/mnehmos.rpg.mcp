/**
 * Does the world change while nobody is watching?
 *
 * `tone.md` makes a promise about the macro layer that is as testable as the
 * micro ones:
 *
 *   "A ten-year retreat must genuinely change the world, and the player must be
 *    able to vanish for decades and return to a substantially different one."
 *
 * That is the whole of macro emergence in one sentence, and nothing checks it.
 * A world that runs its clock and produces the same shape a century later is
 * scenery with a timestamp on it; a world that drifts produces the stories the
 * setting is built to tell - the sect that was strong when you went in and is
 * gone when you come out, the grudge somebody's grandchild is still carrying.
 *
 * So this seeds a world, walks it forward in eras, and reports what a returning
 * cultivator would actually find different. It measures four things, because
 * they fail differently:
 *
 *   POPULATION   do people live, die and get replaced, or does a cohort simply
 *                age out? A world that empties is not drifting, it is dying.
 *   ALTITUDE     is anybody CLIMBING? Not "does the maximum move" - the maximum
 *                is the province's own ceiling and it is supposed to sit still,
 *                so reading it as drift was a mistake this file used to make.
 *                The question is turnover: are the people standing at the top
 *                in five hundred years the same people who were standing there
 *                at the start? A ladder nobody climbs still reports a maximum.
 *   INHERITANCE  goals and grudges carried past their owner's death are the
 *                mechanism the setting has for history mattering. Zero of them
 *                means every generation starts the argument again.
 *   UPHEAVAL     the events the driver files. A century with nothing in it is
 *                the failure the whole `pressure.ts` module exists to prevent.
 *
 * Nothing here is a pass/fail on a number somebody chose. It reports the shape
 * and says which of the four is flat, because "how much drift is right" is a
 * question for a person and "none at all" is not.
 */

import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears, worldShape } from '../src/engine/world/driver.js';

const line = (s = '') => console.log(s);
const rule = (t: string) => { line(); line('='.repeat(92)); line('  ' + t); line('='.repeat(92)); };

/** Eras chosen against the setting's own timescales, not round numbers. */
const ERAS: { years: number; why: string }[] = [
    { years: 10, why: 'an ordinary seclusion' },
    { years: 50, why: 'the settling clock at Qi Condensation' },
    { years: 200, why: 'longer than a mortal cultivator lives' },
    { years: 500, why: 'the acceptance test\'s horizon' }
];

async function main(): Promise<void> {
    rule('DOES THE WORLD CHANGE WHILE NOBODY IS WATCHING?');
    line('  tone.md: "A ten-year retreat must genuinely change the world, and the player must');
    line('            be able to vanish for decades and return to a substantially different one."');
    line();

    const catalog = await loadCultivationCatalog();
    const seeded = seedWorld({ seed: 'drift-audit', catalog });
    let state = seeded.state;
    const first = worldShape(state);

    /** Everybody standing in the top quarter of the ladder, by identity. */
    const highBand = (s: typeof state): Set<string> => new Set(
        s.npcs.filter(n => n.status === 'alive' && n.cultivation.realmOrdinal >= 30).map(n => n.id)
    );
    const startedHigh = highBand(state);
    let replacedAtTheTop = 0;

    line(`  ${'after'.padEnd(22)}${'living'.padStart(7)}${'strongest'.padStart(11)}`
        + `${'inherited goals'.padStart(17)}${'grudges'.padStart(9)}${'events'.padStart(8)}`);
    line('  ' + '-'.repeat(74));
    line(`  ${'seeding'.padEnd(22)}${String(first.livingNpcs).padStart(7)}`
        + `${String(first.strongestOrdinal).padStart(11)}${String(first.inheritedGoals).padStart(17)}`
        + `${String(first.inheritedGrudges).padStart(9)}${'-'.padStart(8)}`);

    let elapsed = 0;
    const shapes = [first];
    let totalEvents = 0;

    for (const era of ERAS) {
        const step = era.years - elapsed;
        const advanced = advanceWorldYears(state, step);
        state = advanced.state;
        elapsed = era.years;

        const events = advanced.events.length;
        const factions = worldShape(state).liveFactions;
        totalEvents += events;
        const shape = worldShape(state);
        shapes.push(shape);

        line(`  ${`${era.years}y - ${era.why}`.slice(0, 21).padEnd(22)}`
            + `${String(shape.livingNpcs).padStart(7)}${String(shape.strongestOrdinal).padStart(11)}`
            + `${String(shape.inheritedGoals).padStart(17)}${String(shape.inheritedGrudges).padStart(9)}`
            + `${String(events).padStart(8)}`);
    }

    const endedHigh = highBand(state);
    for (const id of endedHigh) if (!startedHigh.has(id)) replacedAtTheTop++;
    const survivors = [...endedHigh].filter(id => startedHigh.has(id)).length;

    const last = shapes[shapes.length - 1];
    const flat: string[] = [];
    const moved: string[] = [];

    const note = (name: string, from: number, to: number) =>
        (from === to ? flat : moved).push(`${name} ${from} -> ${to}`);

    note('living', first.livingNpcs, last.livingNpcs);
    // Deliberately NOT `strongest`. See ALTITUDE above: the maximum is the
    // region ceiling and holding still is the correct behaviour for it.
    note('the high band, by name', 0, replacedAtTheTop);
    note('inherited goals', first.inheritedGoals, last.inheritedGoals);
    note('inherited grudges', first.inheritedGrudges, last.inheritedGrudges);
    if (totalEvents === 0) flat.push('events 0 across every era');
    else moved.push(`${totalEvents} events filed across ${ERAS[ERAS.length - 1].years} years`);

    rule('WHAT A RETURNING CULTIVATOR WOULD FIND');
    line();
    line(`  At the top of the ladder (ordinal 30+): ${startedHigh.size} at the seeding, `
        + `${endedHigh.size} at the end.`);
    line(`  ${survivors} of them are the same people. ${replacedAtTheTop} are new.`);
    line(replacedAtTheTop === 0
        ? '  Nobody climbed into the high band in five centuries: the ladder is furniture.'
        : '  The high band turns over, so somebody is climbing it rather than sitting on it.');

    if (moved.length > 0) {
        line();
        line(`  MOVED (${moved.length})`);
        for (const m of moved) line(`    ${m}`);
    }
    if (flat.length > 0) {
        line();
        line(`  FLAT (${flat.length}) - unchanged across ${ERAS[ERAS.length - 1].years} years`);
        for (const f of flat) line(`    ${f}`);
    }

    line();
    if (flat.length === 0) {
        line('  Every axis drifts. Somebody who went into seclusion at the seeding and came out at');
        line(`  ${ERAS[ERAS.length - 1].years} years would find a different world on all four counts.`);
    } else {
        line('  The flat axes are the ones a returning player would notice had not moved, and each');
        line('  is a different failure: a still population is a world that does not replace itself,');
        line('  a still ceiling is a ladder nobody is climbing, and no inheritance is a history');
        line('  that never reaches the living.');
    }
    line();
}

main().catch(error => { console.error(error); process.exit(1); });
