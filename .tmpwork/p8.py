import io
# The cauldron file's own copy becomes a pointer at the general rule.
p = 'src/engine/cultivation/what-you-refine-in.ts'
s = io.open(p, encoding='utf-8').read()
old_start = s.index("/**\n * How much a cauldron of this grade is worth bookkeeping.")
old_end = s.index("/**\n * What a cauldron of this grade adds to a refinement")
new = """/**
 * How much a cauldron of this grade is worth bookkeeping.
 *
 * A RE-EXPORT AND NOT A RULE. The design owner: *"group pills and manuals
 * together, it's all items"*, *"I don't see why any of them should remain
 * separate"*, *"merge it all into a more general class."* A cauldron does not
 * get its own answer to a question every object in the world is asked - the
 * rule is `howMuchAGradeIsWorthTracking` in `possessions.ts`, over any noun,
 * and this name exists only so a reader following the cauldron thread lands on
 * it rather than reinventing one here.
 */
export const howMuchACauldronIsWorthTracking = howMuchAGradeIsWorthTracking;

"""
s = s[:old_start] + new + s[old_end:]
s = s.replace("import type { KeptAs, ObjectSignificance } from '../world/possessions.js';",
              "import { howMuchAGradeIsWorthTracking, type KeptAs } from '../world/possessions.js';")
s = s.replace("""/**
 * COUNTED AND TRACKED, WHICH IS ALREADY THE LINE""", """/**
 * COUNTED AND TRACKED, WHICH IS ALREADY THE LINE""")
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
