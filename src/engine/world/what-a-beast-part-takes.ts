/**
 * What a part off a beast takes up, one part at a time.
 *
 * Played: every hide, tusk and tendon went into the pouch as a 0.6 litre handful, the size of a
 * bundle of herbs, so a spirit beast gave nothing a back could not take. The owner: "this can't be
 * right?", "we need bulky stuff to give spirit boats and carriages a reason to exist", "imagine an
 * ordinal 25 turtle ... huge, right!", and "you can make the materials individual just custom size
 * them".
 *
 * So each part has its own size, in litres and weight, off what it is and what it came off. The
 * scale is the genre's: a hare's pelt goes in a pouch; a boar's plate is a shoulder's load; from
 * the rung where a beast grows a core it is the size of a horse, then a house, and a tortoise a
 * thousand years old sheds scutes like roof tiles off a hall. What the ring grades hold is the
 * yardstick: a mortal ring is a travelling chest (200), an earth ring a cart (4,000), a heaven
 * ring a spirit boat (160,000). A core is the exception: it is the beast's qi drawn to a point, and
 * stays in a hand until the beast is older than the houses.
 */

import { BEAST_MATERIALS } from '../../data/cultivation/beasts.js';
import type { HowMuchRoomItTakes } from './what-a-body-can-carry-and-what-a-ring-holds.js';

/** Litres and weight of one part, material by material. */
const WHAT_EACH_PART_TAKES: Readonly<Record<string, readonly [volume: number, weight: number]>> = {
    // The bottom rungs: animals, and what comes off an animal.
    'mat-hare-pelt': [3, 0.4],
    'mat-cave-fish-oil': [1, 0.9],
    'mat-pheasant-tail': [0.5, 0.05],
    'mat-sparrow-down': [0.8, 0.02],
    'mat-cinder-rat-fleece': [1.5, 0.2],
    'mat-crow-quill': [0.3, 0.02],
    'mat-jerboa-pelt': [1, 0.1],
    'mat-night-cat-pelt': [4, 0.6],
    'mat-wolf-sinew': [1.5, 1],
    'mat-bamboo-viper-fang': [0.1, 0.05],
    'mat-heron-plume': [1, 0.05],
    'mat-magpie-tail': [0.4, 0.03],
    'mat-marmot-fat': [3, 2.5],
    'mat-boar-hide': [30, 14],
    'mat-boar-tusk': [2, 1.5],
    'mat-cliff-goat-horn': [3, 2],
    'mat-drain-bat-membrane': [2, 0.2],
    'mat-ember-crane-plume': [2, 0.1],
    'mat-marten-pelt': [3, 0.4],
    'mat-moth-dust': [0.5, 0.1],
    'mat-spoil-rat-pelt': [1.5, 0.2],
    'mat-swift-nest': [2, 0.5],
    'mat-carp-scale': [1, 0.6],
    'mat-vein-deer-antler': [12, 5],
    'mat-red-sweat': [1, 1],
    'mat-sulphur-toad-gland': [0.5, 0.4],
    'mat-weasel-tail-hair': [0.5, 0.05],
    // Past the tenth rung: big animals, and bigger than any animal a farmer has seen.
    'mat-serpent-gland': [4, 3],
    'mat-trunk-hound-hide': [60, 25],
    'mat-ox-horn': [18, 14],
    'mat-bear-gall': [3, 2],
    'mat-black-eel-skin': [40, 12],
    'mat-core-taker-jaw': [35, 28],
    'mat-deer-musk': [0.5, 0.3],
    'mat-shrine-silk': [6, 0.5],
    'mat-mantis-blade': [45, 30],
    'mat-mole-claw': [10, 9],
    'mat-buffalo-horn': [60, 45],
    'mat-cicada-shell': [20, 4],
    'mat-crane-feather': [8, 0.5],
    'mat-crevasse-chitin': [150, 80],
    'mat-iron-bear-tooth': [4, 5],
    // From the rung a beast grows a core: the size of a horse, then of a house.
    'mat-centipede-segment': [400, 260],
    'mat-hawk-feather': [40, 2],
    'mat-toll-lion-mane': [120, 20],
    'mat-cairn-hound-tooth': [8, 7],
    'mat-leopard-pelt': [260, 70],
    'mat-ridge-lizard-scale': [60, 45],
    'mat-lynx-pelt': [300, 80],
    'mat-ram-horn': [180, 150],
    'mat-salamander-skin': [500, 140],
    'mat-squid-ink': [200, 210],
    'mat-tiger-fang': [30, 28],
    'mat-tiger-pelt': [900, 260],
    'mat-borer-scale': [300, 260],
    'mat-year-beast-hide': [1600, 520],
    'mat-flood-serpent-hide': [3200, 900],
    'mat-hoar-antler': [1400, 700],
    'mat-sun-eater-hide': [2600, 800],
    'mat-firevein-serpent-hide': [4200, 1300],
    'mat-roc-pinion': [2000, 260],
    // And the giants. A horn the size of a boat's prow; a dragon's single scale a door; a
    // tortoise's belly-plate a courtyard, which is what a spirit boat or a heaven ring is for.
    'mat-rhino-horn': [2400, 2600],
    'mat-dragon-scale': [900, 1200],
    'mat-qilin-hair': [20, 2],
    'mat-tortoise-scute': [9000, 11000],
    'mat-tortoise-plastron': [60000, 72000]
};

/** Cores: a gem until the beast is ancient, then a pearl the size of a head. */
const WHAT_EACH_CORE_TAKES: Readonly<Record<string, readonly [volume: number, weight: number]>> = {
    'mat-sleeper-seam-core': [6, 14],
    'mat-tortoise-core': [9, 20],
    'mat-ancient-core': [14, 30],
    'mat-leviathan-core': [40, 90]
};

const A_CORE: readonly [number, number] = [0.3, 0.5];
const SOMETHING_ELSE_OFF_A_BEAST: readonly [number, number] = [8, 6];

const MATERIALS = new Map(BEAST_MATERIALS.map(material => [material.id, material]));

/** Where the parts of a kill too big to take were left: counted stock on the ground, theirs. */
export function whereAKillIsLeft(locationId: string, personId: string): string {
    return `ground:${locationId}:${personId}`;
}

/** Where a part off a kill goes: the pack, a vehicle with them that has the room, or the ground. */
export type WhereAPartGoes =
    | { where: 'pack' }
    | { where: 'vehicle'; vehicleId: string; vehicleName: string }
    | { where: 'ground' };

/**
 * Where one part off a kill ends up. Into the pack when it fits beside what is already carried;
 * into the free hold of a vehicle with them when it does not; and otherwise left where the beast
 * fell, still theirs, for them to come back to with something that can carry it.
 */
export function whereAPartGoes(input: {
    part: HowMuchRoomItTakes;
    carrying: HowMuchRoomItTakes;
    body: HowMuchRoomItTakes;
    vehicles: readonly { id: string; name: string; free: HowMuchRoomItTakes }[];
}): WhereAPartGoes {
    const fits = (room: HowMuchRoomItTakes, already: HowMuchRoomItTakes) =>
        already.volume + input.part.volume <= room.volume && already.weight + input.part.weight <= room.weight;
    if (fits(input.body, input.carrying)) return { where: 'pack' };
    const vehicle = input.vehicles.find(row => fits(row.free, { volume: 0, weight: 0 }));
    return vehicle ? { where: 'vehicle', vehicleId: vehicle.id, vehicleName: vehicle.name } : { where: 'ground' };
}

/** What one part takes up, or null for anything that is not off a beast. */
export function whatABeastPartTakes(itemId: string): HowMuchRoomItTakes | null {
    const material = MATERIALS.get(itemId);
    if (!material) return null;
    const [volume, weight] = material.core
        ? WHAT_EACH_CORE_TAKES[itemId] ?? A_CORE
        : WHAT_EACH_PART_TAKES[itemId] ?? SOMETHING_ELSE_OFF_A_BEAST;
    return { volume, weight };
}
