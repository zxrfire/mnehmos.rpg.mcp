import io

def upto(s, start, end, label):
    a = s.find(start); assert a >= 0, 'start ' + label
    b = s.find(end, a + len(start)); assert b >= 0, 'end ' + label
    return s[:a] + s[b:]

# ── the survivor also reports what a toll actually removed ──────────────
p = 'src/web/apply.ts'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""    /** Engine-authored lines for every price a crossing exacted. */
    tollLines: string[];""",
"""    /** Engine-authored lines for every price a crossing exacted. */
    tollLines: string[];
    /**
     * What each toll actually removed, in the order the tolls came.
     *
     * Reported so a caller can show that what the ledger names was genuinely
     * deleted rather than merely recorded - which is the difference between a
     * crossing that took something and a crossing that said it did.
     */
    tollApplications: TollApplication[];""", 1)
s = s.replace("""    persistUnderstanding,
    persistVisions,
    recordRankGained,
    skipEndState,
    type CultivationRepos
} from '../server/consolidated/cultivation-support.js';""",
"""    persistUnderstanding,
    persistVisions,
    recordRankGained,
    skipEndState,
    type CultivationRepos,
    type TollApplication
} from '../server/consolidated/cultivation-support.js';""", 1)
s = s.replace("""    const tollLines: string[] = [];
    let understanding = { insights: 0, achievements: 0 };""",
"""    const tollLines: string[] = [];
    const tollApplications: TollApplication[] = [];
    let understanding = { insights: 0, achievements: 0 };""", 1)
s = s.replace("""        for (const toll of skip.tolls ?? []) {
            persistToll(repos, run, before.id, toll);
            tollLines.push(tollLine(toll));
        }""",
"""        for (const toll of skip.tolls ?? []) {
            tollApplications.push(persistToll(repos, run, before.id, toll));
            tollLines.push(tollLine(toll));
        }""", 1)
s = s.replace("""        injuries,
        tollLines,
        understanding
    };""",
"""        injuries,
        tollLines,
        tollApplications,
        understanding
    };""", 1)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('survivor widened')
