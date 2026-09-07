import io

NOTE = """    // AND THE WORLD SPENT THEM TOO. This used to move only the run's clock,
    // leaving the world behind by exactly these days until something noticed
    // and ran `catchUp` - which simulates the gap with no access and no
    // observer, so nothing in it was ever knowable to the person who spent it.
"""

def add_after(path, anchor, insert, label):
    s = io.open(path, encoding='utf-8').read()
    assert anchor in s, 'anchor missing in ' + label
    s = s.replace(anchor, anchor + insert, 1)
    io.open(path, 'w', encoding='utf-8', newline='').write(s)

def add_import(path, spec):
    s = io.open(path, encoding='utf-8').read()
    if spec in s:
        return
    at = s.index('\n', s.index('import '))
    s = s[:at + 1] + spec + '\n' + s[at + 1:]
    io.open(path, 'w', encoding='utf-8', newline='').write(s)

IMP = "import { theseDaysPassedInTheWorldToo } from '../state/cultivation-world.js';"

# ── 1. a pill consumed over real days ───────────────────────────────────
p = 'src/server/consolidated/alchemy-manage.ts'
add_import(p, IMP)
add_after(p, """    const after = repos.cultivators.getById(cultivator.id)!;
    const runAfter = repos.runs.getById(run.id)!;

    return {
        consumed: true,""".replace("\n    return {\n        consumed: true,", ""),
    "\n" + NOTE + "    if (days > 0) await theseDaysPassedInTheWorldToo(runAfter, after, days);\n",
    'alchemy')
print('alchemy done')
