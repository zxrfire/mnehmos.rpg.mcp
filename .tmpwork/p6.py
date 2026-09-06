import io
p = 'src/engine/world/seeding.ts'
s = io.open(p, encoding='utf-8').read()
old_start = s.index("    // AND WHAT EACH HOUSE HAS IN ITS TREASURY,")
old_end = s.index("    // AND WHAT EVERY ONE OF THEM IS DOING.")
new = """    // AND WHAT EACH HOUSE HAS IN ITS TREASURY, which was a balance and nothing
    // else. A house held stones and no THINGS, so lending a disciple a furnace,
    // bestowing something on somebody who earned it, and being robbed of
    // anything that mattered all had nothing to operate on. Counted below,
    // tracked above, and both off the standing the ward is rated on.
    //
    // NO SECOND LIST. What a house holds is `state.objects` filtered by
    // `ownerId`, read through `whatThisHouseHolds`. A stored list of ids on the
    // faction would be a second copy of a fact the one possessions table
    // already owns, and the copy is what goes stale the first time something is
    // lent, sold or taken. See `what-a-house-keeps-in-its-treasury.ts`.
    state.objects.push(...seedTreasuries(state));

"""
s = s[:old_start] + new + s[old_end:]
io.open(p, 'w', encoding='utf-8', newline='').write(s)

p2 = 'src/engine/world/what-a-house-keeps-in-its-treasury.ts'
s2 = io.open(p2, encoding='utf-8').read()
s2 += """
/**
 * What this house holds, read off the one possessions table.
 *
 * A FILTER AND NOT A STORED LIST. `WhatAHouseHolds.holds` is a shape for
 * answering the question, not a field anybody writes: the moment a house's
 * inventory is kept in two places, the copy is what goes stale the first time
 * something is lent out, sold or walked off with. `ownerId` is already the
 * answer and it is already maintained by every path that moves a thing.
 *
 * Owned and not held: a furnace a disciple has been lent is still the house's,
 * and still in this list. Which is the point of `whoseThisIs` reading two
 * fields rather than one.
 */
export function whatThisHouseHolds(
    objects: readonly ObjectRecord[],
    factionId: string
): ObjectRecord[] {
    return objects.filter(row => row.ownerId === factionId);
}
"""
io.open(p2, 'w', encoding='utf-8', newline='').write(s2)
print('ok')
