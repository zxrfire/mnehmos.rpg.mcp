import io
p = 'src/engine/world/what-a-house-keeps-in-its-treasury.ts'
s = io.open(p, encoding='utf-8').read()

start = s.index("/**\n * WHICH ROOM OF A HOUSE A THING SITS IN.")
end = s.index("/**\n * The grades a house keeps medicine in at all.")

new = """/**
 * WHICH ROOM OF A HOUSE A THING SITS IN.
 *
 * The design owner: *"these fall out of the 4th layer in terms of places in the
 * map, the rooms."*
 *
 * They do, and a first cut here did not: it declared its own six-value list of
 * rooms, which was a second vocabulary for a thing the map already has. Every
 * one of those rooms already exists as a `RoomPurpose` in `architecture.ts` -
 * `treasury`, `archive`, `alchemy_hall`, `furnace_room`, `workshop` - laid out
 * as real `hall`, `vault` and `chamber` locations under a compound's precincts,
 * with a depth, an obviousness, a capacity and a seal on each. So this returns
 * one of THOSE, and a thing's room is a place on the map somebody can walk to
 * rather than a label.
 *
 * ── AND IT IS DERIVED, WHICH IS WHY IT IS RIGHT ABOUT ROWS IT NEVER WROTE ──
 *
 * *"All of that is tracked under sect ownership - IT DOES HAVE A LEDGER. It's
 * just in different places."*
 *
 * Measured, with a version that wrote the room onto `tags` at seeding: a
 * house's rows came back a third filed and the rest UNFILED, because the ward
 * over its compound and the manuals other systems had already placed were house
 * property this seeder never touched. Two ledgers, and the newer one only knew
 * its own rows.
 *
 * So nothing is written. This is a pure read over `kind` and `significance`,
 * which every object in the world already carries, so it answers for a row this
 * file wrote, a row the ward seeder wrote, and a row nobody has written yet.
 * One ledger - `state.objects` filtered by `ownerId` - and the room is a
 * question you ask it.
 *
 * ── A DEFAULT AND NOT A LAW ──────────────────────────────────────────────
 *
 * *"Good ones in the treasury (for elders to lend, you'd imagine, for example.
 * NON EXHAUSTIVE, NOT STRICT)."* This is where a thing sits when nothing has
 * happened to it. A furnace lent out, a blade taken down, a book somebody is
 * holding are all somewhere else, and `possessorId` already says so.
 */
export function whereInTheHouseItSits(
    kind: ObjectKind,
    significance: ObjectSignificance,
    tags: readonly string[] = []
): RoomPurpose | null {
    // Cut into the ground and never carried, so it is not in a room at all.
    // `formation` means exactly that - see `possessions.ts`.
    if (kind === 'formation' || kind === 'territory') return null;

    // ONE OF IT, AND THE HOUSE KNOWS WHERE IT IS. Whatever it is: the owner's
    // *"some weapons are in the treasury (the best ones)"* and *"the valuable
    // books in the treasury"* are the same sentence about two nouns, which is
    // why this is decided before anything looks at what the thing is.
    if (keptAs(significance) === 'tracked') return 'treasury';

    // Otherwise it lives where that kind of thing is USED. *"The counted ones
    // in the armory"*, *"shitty cauldrons in the furnace area"*, *"shitty books
    // in the library."*
    if (tags.includes('cauldron')) return 'furnace_room';
    switch (kind) {
        case 'pill':
            return 'alchemy_hall';
        case 'manual':
            return 'scripture_pavilion';
        case 'artifact':
        case 'key':
        case 'token':
            return 'workshop';
        default:
            return 'tribute_room';
    }
}

"""
s = s[:start] + new + s[end:]

# The convenience reader, rewritten onto RoomPurpose.
old_tail_start = s.index("/**\n * Everything a house owns, sorted into the rooms it is in.")
s = s[:old_tail_start] + """/**
 * Everything a house owns, sorted into the rooms it is in.
 *
 * THE READ THE LEDGER OWES. *"It's just in different places"* - so the answer
 * to *what does this house have* is a list per room, which is the way a
 * quartermaster, a thief and a disciple asking to borrow something all want it.
 *
 * The owner, on why this matters beyond bookkeeping: *"that gives NPCs a reason
 * to go to diff areas."* A compound whose rooms hold nothing is a compound
 * nobody has an errand in.
 *
 * Keyed on `RoomPurpose` and null for the things that stand in the ground.
 * Derived every time and cached nowhere, which is why it is right about rows
 * this file never wrote.
 */
export function whatIsInEachRoom(
    objects: readonly ObjectRecord[],
    factionId: string
): Map<RoomPurpose | null, ObjectRecord[]> {
    const rooms = new Map<RoomPurpose | null, ObjectRecord[]>();
    for (const row of whatThisHouseHolds(objects, factionId)) {
        const room = whereInTheHouseItSits(row.kind, row.significance, row.tags);
        const held = rooms.get(room) ?? [];
        held.push(row);
        rooms.set(room, held);
    }
    return rooms;
}
"""

s = s.replace("import type { WorldState } from './world-state.js';",
              "import type { RoomPurpose } from './architecture.js';\nimport type { WorldState } from './world-state.js';")
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
