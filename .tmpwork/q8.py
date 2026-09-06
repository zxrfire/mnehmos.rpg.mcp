import io

# ── 1. The retired name lives with the realm it used to be ──────────────
p = 'src/engine/cultivation/realms.ts'
s = io.open(p, encoding='utf-8').read()

anchor = "export const MAX_ORDINAL"
i = s.index(anchor)
block = '''/**
 * NAMES A REALM USED TO GO BY, AND STILL ANSWERS TO.
 *
 * Void Refinement became Void Tribulation because alchemy took the word - see
 * the note on the tier itself. The KEY did not move, and neither did anything a
 * save holds, but a rename has one cost a key does not pay: everything already
 * SAID stays said.
 *
 * WHICH MATTERS HERE MORE THAN IN AN ORDINARY CODEBASE. A run's transcript is
 * the classifier's context. Somebody forty turns into a run has forty turns of
 * narration behind them that says Void Refinement, and both they and the model
 * reading for them will go on saying it. A parser that answers "no such realm"
 * to a word the game itself printed an hour ago is not being precise, it is
 * being wrong about its own history.
 *
 * So a retired name resolves, forever, to the realm that carried it. It is
 * never PRINTED - `REALM_TIERS` owns what a realm is called - and nothing reads
 * this except the readers that turn a player's words into a rung.
 */
export const A_REALM_ANSWERS_TO: Readonly<Record<string, RealmKey>> = {
    'void refinement': 'void_refinement'
};

'''
s = s[:i] + block + s[i:]
io.open(p, 'w', encoding='utf-8', newline='').write(s)

# ── 2. The description reader consults it ───────────────────────────────
p2 = 'src/web/a-target-can-be-a-description.ts'
s2 = io.open(p2, encoding='utf-8').read()

old = """    let realmKey: string | null = null;
    for (const tier of REALM_TIERS) {
        if (tier.name.split(' ').length < 2) continue;
        const at = rest.indexOf(tier.name.toLowerCase());
        if (at < 0) continue;
        realmKey = tier.key;
        rest = `${rest.slice(0, at)} ${rest.slice(at + tier.name.length)}`;
        break;
    }"""
assert old in s2, 'realm loop not found'
new = """    let realmKey: string | null = null;
    // What they are called now, and what they have ever been called. A run's
    // transcript is the classifier's context, so a realm that was renamed goes
    // on being said by everybody who read the narration from before it moved -
    // see `A_REALM_ANSWERS_TO`. Retired names are read and never printed.
    const byName: [string, string][] = [
        ...REALM_TIERS.map(tier => [tier.name.toLowerCase(), tier.key] as [string, string]),
        ...Object.entries(A_REALM_ANSWERS_TO)
    ];
    for (const [name, key] of byName) {
        if (name.split(' ').length < 2) continue;
        const at = rest.indexOf(name);
        if (at < 0) continue;
        realmKey = key;
        rest = `${rest.slice(0, at)} ${rest.slice(at + name.length)}`;
        break;
    }"""
s2 = s2.replace(old, new, 1)

# import it
assert 'REALM_TIERS' in s2
import re
m = re.search(r"import \{([^}]*REALM_TIERS[^}]*)\} from '([^']*realms[^']*)';", s2)
assert m, 'realms import not found'
s2 = s2[:m.start(1)] + m.group(1).replace('REALM_TIERS', 'A_REALM_ANSWERS_TO,\n    REALM_TIERS', 1) + s2[m.end(1):]
io.open(p2, 'w', encoding='utf-8', newline='').write(s2)
print('ok')
