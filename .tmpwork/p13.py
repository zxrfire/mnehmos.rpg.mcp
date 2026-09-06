import io
p = 'src/engine/world/what-a-house-keeps-in-its-treasury.ts'
s = io.open(p, encoding='utf-8').read()

s = s.replace(""" * A DEFAULT AND NOT A LAW. The owner: *"good ones in the treasury (for elders
 * to lend, you'd imagine, for example. NON EXHAUSTIVE, NOT STRICT)."* This is
 * where a thing sits when nothing has happened to it. Anything that has - a
 * furnace lent out, a blade taken down, a book somebody is holding - is
 * somewhere else, and the row already says so in `possessorId`. Nothing here
 * re-derives a location for a thing that has moved, and nothing enforces one.""",
""" * A DEFAULT AND NOT A LAW. The owner: *"good ones in the treasury (for elders
 * to lend, you'd imagine, for example. NON EXHAUSTIVE, NOT STRICT)."* This is
 * where a thing sits when nothing has happened to it. Anything that has - a
 * furnace lent out, a blade taken down, a book somebody is holding - is
 * somewhere else, and the row already says so in `possessorId`. Nothing here
 * enforces a room and nothing writes one down.
 *
 * ── AND IT IS ONE LEDGER, WHICH IS WHY THE ROOM IS NOT A FIELD ───────────
 *
 * *"All of that is tracked under sect ownership - IT DOES HAVE A LEDGER. It's
 * just in different places."*
 *
 * Measured, with a first cut that wrote the room onto `tags` at seeding: a
 * house's rows came back with a third of them filed and the rest UNFILED -
 * because the ward over its compound, and the manuals other systems had already
 * placed, were house property that this seeder never touched. Two ledgers, and
 * the newer one only knew about its own rows.
 *
 * So the room is not written anywhere. `whereInTheHouseItSits` is a pure read
 * over `kind` and `significance`, which every object in the world already
 * carries, so it answers for a row this file wrote, a row the ward seeder
 * wrote, and a row that has not been written yet. One ledger - `state.objects`
 * filtered by `ownerId` - and the room is a question you ask it.""")

# Drop the tag writes. The room is derived, so a stored copy can only go stale.
s = s.replace(
    "        plain.tags = ['cauldron', whereInTheHouseItSits('other', 'mundane', ['cauldron'])];",
    "        plain.tags = ['cauldron'];")
s = s.replace("""                tags: [
                    'cauldron',
                    'defensive',
                    whereInTheHouseItSits('artifact', howMuchACauldronIsWorthTracking(grade), ['cauldron']),
                    `grade:${grade}`
                ],""",
"""                tags: ['cauldron', 'defensive', `grade:${grade}`],""")
s = s.replace("""            lot.tags = [
                thing.kind,
                whereInTheHouseItSits(thing.kind, significance),
                `grade:${thing.grade}`
            ];""",
"""            lot.tags = [thing.kind, `grade:${thing.grade}`];""")
s = s.replace("""            tags: [
                thing.kind,
                whereInTheHouseItSits(thing.kind, significance),
                `grade:${thing.grade}`
            ],""",
"""            tags: [thing.kind, `grade:${thing.grade}`],""")

# And a reader that answers the room for anything a house owns.
s = s.replace("""export function whereInTheHouseItSits(
    kind: ObjectKind,
    significance: ObjectSignificance,
    tags: readonly string[] = []
): WhereInAHouse {""",
"""export function whereInTheHouseItSits(
    kind: ObjectKind,
    significance: ObjectSignificance,
    tags: readonly string[] = []
): WhereInAHouse {
    // A ward is cut into the ground and is not in a room at all. `formation`
    // means exactly that - see `possessions.ts` - so it is answered before
    // anything about how much it is worth.
    if (kind === 'formation' || kind === 'territory') return 'nowhere_it_could_be_moved_from';""")
s = s.replace("""export type WhereInAHouse =
    | 'the_treasury'""",
"""export type WhereInAHouse =
    /** Cut into the ground, standing where it was made. A ward, a holding. */
    | 'nowhere_it_could_be_moved_from'
    | 'the_treasury'""")
s = s.replace("""    switch (where) {
        case 'the_treasury':
            return 'the treasury';""",
"""    switch (where) {
        case 'nowhere_it_could_be_moved_from':
            return 'the ground the compound stands on';
        case 'the_treasury':
            return 'the treasury';""")

s += """
/**
 * Everything a house owns, sorted into the rooms it is in.
 *
 * THE READ THE LEDGER OWES. *"It's just in different places"* - so the answer
 * to *what does this house have* is not a list, it is a list per room, and a
 * quartermaster, a thief and a disciple asking to borrow something all want it
 * that way round.
 *
 * Derived every time and cached nowhere, which is why it is right about rows
 * this file never wrote.
 */
export function whatIsInEachRoom(
    objects: readonly ObjectRecord[],
    factionId: string
): Map<WhereInAHouse, ObjectRecord[]> {
    const rooms = new Map<WhereInAHouse, ObjectRecord[]>();
    for (const row of whatThisHouseHolds(objects, factionId)) {
        const room = whereInTheHouseItSits(row.kind, row.significance, row.tags);
        const held = rooms.get(room) ?? [];
        held.push(row);
        rooms.set(room, held);
    }
    return rooms;
}
"""
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
