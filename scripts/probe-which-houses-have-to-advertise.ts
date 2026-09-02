/**
 * Who is reduced to putting up paper, where it goes up, and what a fresh life
 * can read on the wall it was born next to.
 *
 * The companion to `probe-what-one-house-a-new-life-can-name.ts`, which
 * measures what a life is SEEDED with. This one measures the other channel:
 * the houses that come looking, because a name granted at birth is a fixed
 * list and cannot produce a name later.
 *
 * Nothing here is a threshold to tune. The two things worth watching are the
 * SPREAD - if one house is doing all the advertising the feature has stopped
 * working - and the last line, which is how many distinct doors the channel
 * puts in front of a new player at all.
 *
 * Run: node --loader ts-node/esm scripts/probe-which-houses-have-to-advertise.ts
 */
import { REGIONS } from '../src/data/cultivation/regions.js';
import {
    housesThatHaveToAdvertise,
    billsOnTheWall,
    reachesThisGround
} from '../src/engine/world/houses-that-have-to-advertise-for-disciples.js';
import {
    openDoorsInTheWorld,
    postingGroundOf,
    provinceOfPlace
} from '../src/web/what-is-posted-on-the-wall-here.js';
import { drawBirth } from '../src/engine/birth/birth.js';

const field = openDoorsInTheWorld();
console.log(`OPEN DOORS IN THE WORLD: ${field.length}`);
const advertisers = housesThatHaveToAdvertise(field);
console.log(`HOUSES THAT HAVE TO ADVERTISE: ${advertisers.length}`);
for (const h of advertisers) {
    console.log(
        `  bar=${String(h.admissionOrdinal).padStart(2)} pow=${String(h.powerOrdinal).padStart(2)} `
        + `${h.why.padEnd(10)} prov=${(h.provinceId ?? '-').padEnd(22)} ${h.name}`
    );
}

console.log('\nEVERY NAMED PLACE, GROUND AND HOW MANY BILLS IT COULD CARRY:');
let placesWithWalls = 0;
let places = 0;
for (const region of REGIONS) {
    for (const p of region.places) {
        places++;
        const prov = provinceOfPlace(p.name);
        const reach = advertisers.filter(h => reachesThisGround(h, prov));
        const bills = billsOnTheWall({
            field, placeName: p.name, ground: postingGroundOf(p.name),
            placeProvinceId: prov, onDay: 1000, seed: 'probe'
        });
        if (bills.length > 0) placesWithWalls++;
        console.log(
            `  ${p.name.padEnd(20)} ${p.kind.padEnd(12)} prov=${(prov ?? '-').padEnd(22)} `
            + `reach=${String(reach.length).padStart(2)} posted=${bills.length}`
        );
    }
}
console.log(`\n${placesWithWalls}/${places} named places carry a bill.`);

// ── WHAT A FRESH LIFE WOULD READ WHERE IT WAS BORN ──────────────────────
console.log('\nTWENTY FRESH LIVES: birthplace, ground, and what is on the wall there:');
let sawSomething = 0;
const namesSeen = new Set<string>();
for (let i = 0; i < 20; i++) {
    const seed = `life-${i}`;
    const birth = drawBirth(seed);
    const place = birth.place.name;
    const prov = provinceOfPlace(place);
    const bills = billsOnTheWall({
        field, placeName: place, ground: postingGroundOf(place),
        placeProvinceId: prov, onDay: 0, seed
    });
    for (const b of bills) namesSeen.add(b.houseName);
    if (bills.length > 0) sawSomething++;
    console.log(
        `  ${place.padEnd(20)} ${postingGroundOf(place).padEnd(12)} `
        + `-> ${bills.map(b => b.houseName).join(' | ') || '(no wall)'}`
    );
}
console.log(`\n${sawSomething}/20 lives can read a bill without leaving home.`);
console.log(`Distinct houses named across those walls: ${namesSeen.size}`);
console.log([...namesSeen].sort().join(', '));
