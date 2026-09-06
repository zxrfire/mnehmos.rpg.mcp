import io

# ── 1. one clause, chosen the way the existing disposition read chooses ──
p = 'src/engine/world/what-somebody-is-like-and-where-it-came-from.ts'
s = io.open(p, encoding='utf-8').read()
s += '''
/**
 * THE ONE CLAUSE A PERSON GETS, or null where there is nothing to say.
 *
 * `scene-person-readings.ts` already established the shape: a sentence gets at
 * most ONE clause of disposition, and only when the reading is MARKED. Two
 * clauses about somebody standing in a square is a character sheet read aloud,
 * and the third time a player sees one they stop reading them.
 *
 * So the deeper of the two axes wins, and neither speaks below the band. Most
 * people say nothing here, which is correct: a world where everybody is a
 * character is a world where nobody is.
 */
export function theOneThingWorthSayingAbout(person: {
    id: string;
    identity: { origin: OriginTierKey };
    cultivation: { attributes: InnateAttributes; realmOrdinal: number };
}): string | null {
    const { push, room } = whatSomebodyIsLike(person);
    if (Math.abs(push) < MARKED && Math.abs(room) < MARKED) return null;
    return Math.abs(push) >= Math.abs(room)
        ? howTheyGoAtThings(push)
        : howTheyWantItSeen(room);
}
'''
io.open(p, 'w', encoding='utf-8', newline='').write(s)

# ── 2. the square carries it ────────────────────────────────────────────
p2 = 'src/web/facts.ts'
s2 = io.open(p2, encoding='utf-8').read()
old = """    withNames: string[];
}"""
new = """    withNames: string[];
    /**
     * The one thing worth saying about who they are, or null for most people.
     *
     * Not what they are doing - `at` is that, and it changes. This is what they
     * are LIKE, which does not, and it falls out of what the world rolled for
     * them at birth rather than being stored anywhere. See
     * `what-somebody-is-like-and-where-it-came-from.ts`.
     *
     * Printed only for the person a square hands you on arrival, which is the
     * one place there is room for it. Asking who else is here is a roster, and
     * a roster with a character note against every line is a briefing.
     */
    like: string | null;
}"""
assert old in s2, 'SomebodyInTheSquare tail not found'
s2 = s2.replace(old, new, 1)

old2 = """            sentences.push(met.at === null
                ? `${met.name} is here.`
                : `${met.name} is here, ${met.at}.`);"""
new2 = """            sentences.push(met.at === null
                ? `${met.name} is here.`
                : `${met.name} is here, ${met.at}.`);
            // AND ONE THING ABOUT WHO THEY ARE, where there is one. This is the
            // person the ground chose to hand over, so it is the one place in
            // the game with room to say what they are like as well as what they
            // are at - and most people have nothing here, which is the point.
            if (met.like !== null) sentences.push(`${met.name} ${met.like}.`);"""
assert old2 in s2, 'walking_up branch not found'
s2 = s2.replace(old2, new2, 1)
io.open(p2, 'w', encoding='utf-8', newline='').write(s2)

# ── 3. filled where the record is actually in hand ──────────────────────
p3 = 'src/web/turn-engine.ts'
s3 = io.open(p3, encoding='utf-8').read()
old3 = """                    playsToTheRoom: row === null ? 0 : whatSomebodyIsLike(row).room,
                    withNames: alongside"""
new3 = """                    playsToTheRoom: row === null ? 0 : whatSomebodyIsLike(row).room,
                    withNames: alongside,
                    // Only from the world row, never from the roster one. The
                    // roster carries no attributes and no origin, so deriving
                    // this from it would make the same person read differently
                    // depending on which table the caller happened to reach -
                    // the exact thing deriving instead of storing is for.
                    like: row === null ? null : theOneThingWorthSayingAbout(row)"""
assert old3 in s3, 'company fields not found'
s3 = s3.replace(old3, new3, 1)
s3 = s3.replace("import { whatSomebodyIsLike } from '../engine/world/what-somebody-is-like-and-where-it-came-from.js';",
                "import {\n"
                "    theOneThingWorthSayingAbout,\n"
                "    whatSomebodyIsLike\n"
                "} from '../engine/world/what-somebody-is-like-and-where-it-came-from.js';", 1)
io.open(p3, 'w', encoding='utf-8', newline='').write(s3)
print('ok')
