import io
p = 'src/server/consolidated/alchemy-manage.ts'
s = io.open(p, encoding='utf-8').read()

old = """function refineChance(
    baseRate: number,
    ordinal: number,
    requiredOrdinal: number,
    insight: number,
    supplementBonus: number
): { chance: number; modifiers: Array<{ source: string; delta: number }> } {
    const modifiers: Array<{ source: string; delta: number }> = [
        { source: 'recipe_base', delta: baseRate }
    ];

    const margin = Math.min(
        REFINE_REALM_MARGIN_CAP,
        Math.max(0, ordinal - requiredOrdinal) * REFINE_REALM_MARGIN_PER_ORDINAL
    );
    modifiers.push({ source: 'realm_margin', delta: margin });
    modifiers.push({ source: 'insight', delta: (insight - 2) * REFINE_INSIGHT_PER_POINT });"""
assert old in s, 'refineChance not found'

new = """function refineChance(
    baseRate: number,
    ordinal: number,
    requiredOrdinal: number,
    insight: number,
    supplementBonus: number,
    /**
     * What they are actually refining IN, or null for the clay pot everybody
     * has. `recipes.ts` has named cauldron quality as an input to a refinement
     * since the file was written - *"the floor the engine starts from before
     * alchemy skill, CAULDRON QUALITY, spirit root and ambient qi are
     * applied"* - and until now there was no cauldron, so every alchemist in
     * the world worked out of the same nothing.
     */
    cauldron: TechniqueGrade | null = null
): { chance: number; modifiers: Array<{ source: string; delta: number }> } {
    const modifiers: Array<{ source: string; delta: number }> = [
        { source: 'recipe_base', delta: baseRate }
    ];

    const margin = Math.min(
        REFINE_REALM_MARGIN_CAP,
        Math.max(0, ordinal - requiredOrdinal) * REFINE_REALM_MARGIN_PER_ORDINAL
    );
    modifiers.push({ source: 'realm_margin', delta: margin });
    modifiers.push({ source: 'insight', delta: (insight - 2) * REFINE_INSIGHT_PER_POINT });
    // THE FURNACE, AND ONLY WHERE THE HAND CAN WORK IT. A great cauldron held
    // by somebody who cannot work its materials is a great cauldron full of
    // slag, so `whatThisCauldronAddsFor` returns nothing below the rung rather
    // than a bonus that could not have been earned. Nothing is subtracted for
    // the clay pot: it is the baseline every `baseSuccessRate` was written
    // against, and taxing it would silently reprice the whole table.
    if (cauldron !== null) {
        const fromTheFurnace = whatThisCauldronAddsFor(cauldron, ordinal);
        if (fromTheFurnace !== 0) {
            modifiers.push({ source: `cauldron:${cauldron}`, delta: fromTheFurnace });
        }
    }"""
s = s.replace(old, new, 1)

s = s.replace("import { getHerb } from '../../data/cultivation/herbs.js';",
              "import { getHerb } from '../../data/cultivation/herbs.js';\n"
              "import { whatThisCauldronAddsFor } from '../../engine/cultivation/what-you-refine-in.js';", 1)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
