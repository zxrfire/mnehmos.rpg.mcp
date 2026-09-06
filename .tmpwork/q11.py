import io
p = 'src/server/consolidated/alchemy-manage.ts'
s = io.open(p, encoding='utf-8').read()

# ── the listing ─────────────────────────────────────────────────────────
old = """        const ingredients = recipe.ingredients.map(ing => {
            const herb = getHerb(ing.itemId);
            return {
                itemId: ing.itemId,
                name: herb?.name ?? ing.itemId,"""
new = """        const ingredients = recipe.ingredients.map(ing => {
            // ONE RESOLVER, BOTH SOURCES. A recipe ingredient is a herb or it
            // is something taken off a spirit beast, and a cauldron does not
            // care which - see `what-a-cauldron-will-take.ts`. Reading through
            // `getHerb` here is what made a beast core a thing you could hunt,
            // harvest, carry and sell, and could not refine with.
            const material = whatAnIngredientIs(ing.itemId);
            return {
                itemId: ing.itemId,
                name: material?.name ?? ing.itemId,"""
assert old in s, 'listing not found'
s = s.replace(old, new, 1)

# ── the stock check and its refusal ─────────────────────────────────────
old2 = """        .map(ing => {
            const herb = getHerb(ing.itemId);
            const held = pouchQuantity(repos.db, cultivator.id, ing.itemId);
            return {
                itemId: ing.itemId,
                name: herb?.name ?? ing.itemId,
                required: ing.quantity,
                held,
                short: ing.quantity - held,
                // Where it grows and how high the ground has to be before it
                // gives any up. Both are already on the herb row; a refusal
                // that omits them tells somebody to go and get a thing without
                // saying where, or whether they can.
                biome: herb?.biome ?? null,
                harvestOrdinal: herb?.harvestOrdinal ?? null
            };
        })"""
new2 = """        .map(ing => {
            const herb = getHerb(ing.itemId);
            const material = whatAnIngredientIs(ing.itemId);
            const held = pouchQuantity(repos.db, cultivator.id, ing.itemId);
            return {
                itemId: ing.itemId,
                name: material?.name ?? ing.itemId,
                required: ing.quantity,
                held,
                short: ing.quantity - held,
                // Where it grows and how high the ground has to be before it
                // gives any up. Both are already on the row; a refusal that
                // omits them tells somebody to go and get a thing without
                // saying where, or whether they can. `biome` is a herb's own
                // field and stays null for a beast material, whose answer to
                // "where" is a different sentence - see `howYouWouldComeByIt`.
                biome: herb?.biome ?? null,
                harvestOrdinal: material?.harvestOrdinal ?? null,
                from: material?.from ?? null,
                route: material === null ? null : howYouWouldComeByIt(material)
            };
        })"""
assert old2 in s, 'stock check not found'
s = s.replace(old2, new2, 1)

old3 = """        const where = ` ${missing.map(i => `${i.name} grows ${i.biome === null
            ? 'somewhere nobody has written down'
            : `on ${String(i.biome).replace(/_/g, ' ')}`}`).join('; ')}.`;"""
new3 = """        // AND WHAT THE HONEST ROUTE ACTUALLY IS. A herb grows somewhere; a
        // beast material is currently inside something that will object. Those
        // are different afternoons and a refusal that says "grows" about a
        // spirit beast's core is telling somebody to go and pick one.
        const where = ` ${missing.map(i => i.route ?? `${i.name} grows ${i.biome === null
            ? 'somewhere nobody has written down'
            : `on ${String(i.biome).replace(/_/g, ' ')}`}`).join('; ')}.`;"""
assert old3 in s, 'refusal text not found'
s = s.replace(old3, new3, 1)

s = s.replace("import { getHerb } from '../../data/cultivation/herbs.js';",
              "import { getHerb } from '../../data/cultivation/herbs.js';\n"
              "import {\n"
              "    howYouWouldComeByIt,\n"
              "    whatAnIngredientIs\n"
              "} from '../../engine/cultivation/what-a-cauldron-will-take.js';", 1)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
