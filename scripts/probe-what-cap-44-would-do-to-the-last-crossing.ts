/**
 * Would capping the deep roads at 44 give somebody a road to 44, or take the
 * last crossing away from everybody?
 *
 * The four roads that reach the top of the ladder carry `cap` 45 today, which
 * reads like an overshoot: 45 is False Immortal, and `realms.ts` says that rung
 * is reachable only by surviving the crossing and by nothing else. The obvious
 * correction is to write 44 on them, so that the book ends where the ladder
 * ends.
 *
 * `cap` does not mean what that reading assumes. `techniqueExhausted` is
 * `realmOrdinal >= cap`, so a cap is the first rung at which the paper stops
 * carrying you - not the last rung it teaches. A book capped at 44 stops a
 * cultivator who is STANDING on 44, which is exactly the person who is
 * gathering the qi for the last crossing, and the last crossing is an attempt
 * FROM 44 (`LAST_CROSSING_ORDINAL`).
 *
 * So this is a two-row controlled table rather than an argument. Same
 * cultivator, same rung, one number different.
 *
 * Run: npx tsx scripts/probe-what-cap-44-would-do-to-the-last-crossing.ts
 */
import {
    techniqueExhausted,
    techniqueCeiling,
    ordinaryCapFor
} from '../src/engine/cultivation/cultivation.js';
import {
    LAST_CROSSING_ORDINAL,
    progressRequiredForOrdinal,
    rankName,
    realmForOrdinal
} from '../src/engine/cultivation/realms.js';

console.log(`the last crossing is an attempt FROM ordinal ${LAST_CROSSING_ORDINAL} (${rankName(LAST_CROSSING_ORDINAL)})`);
console.log(`it costs ${progressRequiredForOrdinal(LAST_CROSSING_ORDINAL)} qi-units to summon\n`);

console.log('cap  standing at 44: exhausted?  what the engine tells the player');
for (const cap of [44, 45]) {
    const why = techniqueCeiling(LAST_CROSSING_ORDINAL, cap) as { multiplier: number; label: string };
    console.log(
        ` ${cap}  ${String(techniqueExhausted(LAST_CROSSING_ORDINAL, cap)).padEnd(26)} ` +
        `rate x${why.multiplier} - ${why.label}`
    );
}

console.log('\nand at every rung of the last realm:');
console.log(' ord  cap 44  cap 45');
for (let o = realmForOrdinal(41).ordinalStart; o <= realmForOrdinal(41).ordinalEnd; o++) {
    console.log(
        String(o).padStart(4),
        String(techniqueExhausted(o, 44) ? 'STOPPED' : 'climbs ').padStart(7),
        String(techniqueExhausted(o, 45) ? 'STOPPED' : 'climbs ').padStart(7)
    );
}

console.log(`\nordinaryCapFor(41) = ${ordinaryCapFor(41)}  (what the four roads take today)`);
console.log(
    '\nCONCLUSION: 45 is the cap that lets somebody stand at 44 and gather for the\n' +
    'crossing. 44 is the cap that stops them on the rung the crossing is made from,\n' +
    'so nobody could ever attempt it and the Immortal realm would be unreachable by\n' +
    'any route in the game.'
);
