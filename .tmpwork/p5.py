import io
p = 'src/engine/world/seeding.ts'
s = io.open(p, encoding='utf-8').read()
s = s.replace("import { seedHouseWards } from './the-ward-a-house-raised-over-its-own-ground.js';",
              "import { seedHouseWards } from './the-ward-a-house-raised-over-its-own-ground.js';\n"
              "import { seedTreasuries } from './what-a-house-keeps-in-its-treasury.js';")
old = "    state.objects.push(...seedHouseWards(state));\n"
new = """    state.objects.push(...seedHouseWards(state));

    // AND WHAT EACH HOUSE HAS IN ITS TREASURY, which was a balance and an empty
    // list. A house held stones and no THINGS, so lending a disciple a furnace,
    // bestowing something on somebody who earned it, and being robbed of
    // anything that mattered all had nothing to operate on. Counted below,
    // tracked above, and both off the standing the ward is rated on - see
    // `what-a-house-keeps-in-its-treasury.ts`.
    const kept = seedTreasuries(state);
    state.objects.push(...kept);
    // And the house's own list of what it holds, which is ids and not rows:
    // the one possessions table is the record, and a second copy here is the
    // duplication `items.md` names.
    for (const row of kept) {
        if (row.ownerId === null) continue;
        const house = state.factions.find(f => f.id === row.ownerId);
        if (house === undefined) continue;
        house.resources.treasuryObjectIds = [
            ...(Array.isArray(house.resources.treasuryObjectIds)
                ? house.resources.treasuryObjectIds as string[]
                : []),
            row.id
        ];
    }
"""
assert old in s
s = s.replace(old, new, 1)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
