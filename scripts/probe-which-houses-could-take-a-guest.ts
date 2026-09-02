/**
 * Which houses would take a guest, what each would show one, and what each
 * keeps back.
 *
 * The whole of guest studentship rests on one comparison being real in the data
 * rather than asserted: a house's SHELF against the band it holds in quantity.
 * Where the shelf runs past that band there is depth behind the door and the
 * shallow end can be opened at no cost. Where it does not, opening anything
 * opens everything, and the house does not open the door.
 *
 * Run:  node --loader ts-node/esm scripts/probe-which-houses-could-take-a-guest.ts
 */
import { SECTS, intakeRouteOf } from '../src/data/cultivation/sects.js';
import { rankName } from '../src/engine/cultivation/realms.js';
import {
    shelfTopOf,
    takesGuests,
    guestTermYears,
    whatAHouseWillShowAGuest,
    whatAHouseKeepsBack
} from '../src/engine/encounters/what-a-house-will-teach-somebody-it-has-not-taken.js';

const rows: string[] = [];
let takes = 0, houses = 0, housesTaking = 0;
const openSizes: number[] = [];

for (const s of SECTS) {
    const isHouse = s.id.startsWith('house-');
    if (isHouse) houses += 1;
    const top = shelfTopOf(s.id);
    const yes = takesGuests(s.id);
    const opens = whatAHouseWillShowAGuest(s.id);
    if (yes && opens.length > 0) {
        takes += 1;
        if (isHouse) housesTaking += 1;
        openSizes.push(opens.length);
    }
    rows.push(
        `${s.id.padEnd(38)} ${(intakeRouteOf(s.id) ?? '?').padEnd(8)} `
        + `bar=${String(s.admissionOrdinal).padStart(2)} `
        + `shelfTop=${String(top ?? '-').padStart(3)} `
        + `${yes && opens.length > 0 ? `GUESTS term=${String(guestTermYears(s.id)).padStart(2)}y` : '  ----          '} `
        + `opens=${String(opens.length).padStart(2)} keeps=${String(whatAHouseKeepsBack(s.id).length).padStart(2)}`
        + (yes && opens.length > 0
            ? `\n      OPEN: ${opens.map(o =>
                `${o.name} (need ${o.requiredOrdinal}, ${o.carriesTo === null ? 'carries nobody' : `to ${rankName(o.carriesTo)}`})`
            ).join('; ')}`
            : '')
    );
}

rows.sort();
console.log(rows.join('\n'));
openSizes.sort((a, b) => a - b);
console.log(
    `\n${takes} of ${SECTS.length} bodies would take a guest `
    + `(${housesTaking} of ${houses} dao houses).`
    + `\nOpen-set sizes: min ${openSizes[0]}, median ${openSizes[Math.floor(openSizes.length / 2)]}, `
    + `max ${openSizes[openSizes.length - 1]}.`
);
