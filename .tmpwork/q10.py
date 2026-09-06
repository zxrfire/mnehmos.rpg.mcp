import io

# ── 1. "who else is here" is the roster, not the ground ─────────────────
p = 'src/web/verb-pattern-table.ts'
s = io.open(p, encoding='utf-8').read()

old = "|who else is (?:here|drawing)|"
assert old in s, 'crowding pattern not found'
new = "|who else is drawing|"
s = s.replace(old, new, 1)

marker = "    // who else is drawing on this ground\n"
assert marker in s
note = """    // ── WHO ELSE IS DRAWING, WHICH IS NOT WHO ELSE IS HERE ───────────────
    //
    // This claimed "who else is here" as well, and it is the wrong owner for
    // it. The design owner named that exact sentence as the DELIBERATE ASK a
    // player makes for the roster: *"if there's more people, you have to
    // specifically ask: who else is here?"* - which is `look/company` and the
    // whole other half of `walking-in-is-not-reading-the-roster`.
    //
    // Crowding keeps "who else is DRAWING", which is the question it was named
    // for: how many people are pulling on this ground, and what that does to
    // the rate. Two different questions that happened to share four words.
"""
s = s.replace(marker, note + marker, 1)
io.open(p, 'w', encoding='utf-8', newline='').write(s)

# ── 2. The two tests ask for the roster instead of reading the arrival ──
for path, helper in [
    ('tests/web/a-cultivator-is-what-they-have-done.test.ts', True),
    ('tests/web/the-dao-heart-is-reachable-by-a-sentence.test.ts', False),
]:
    t = io.open(path, encoding='utf-8').read()
    old_h = """async function whoIsHere(game: { act(text: string): Promise<{ narration: string }> }): Promise<string[]> {
    const look = await game.act('I look around');
    const line = /^(.*?) (?:is|are) here\\./m.exec(look.narration);
    if (!line) return [];
    return line[1].split(/,| and /).map(s => s.trim()).filter(Boolean);
}"""
    if old_h not in t:
        print(f'  {path}: helper not found, skipped')
        continue
    new_h = """async function whoIsHere(game: { act(text: string): Promise<{ narration: string }> }): Promise<string[]> {
    // ASKED, AND NOT GLANCED AT.
    //
    // This used to read the arrival prose from `I look around`, and that stopped
    // being the roster: the design owner's ruling is that walking into a square
    // hands you ONE person or their party, and everybody else is a count -
    // *"you don't necessarily know everyone who is here right off the bat"* -
    // with the roster reserved for the sentence a player deliberately types,
    // *"who else is here?"*
    //
    // So the harvester asks, which is what a player does and what the feature
    // is for. Still read out of the words the game printed rather than pinned:
    // AGENTS.md - *any name the game prints is a name the game must accept.*
    const look = await game.act('who else is here');
    const line = /^(.*?) (?:is|are) here\\./m.exec(look.narration);
    if (!line) return [];
    return line[1].split(/,| and /).map(s => s.trim()).filter(Boolean);
}"""
    t = t.replace(old_h, new_h, 1)
    io.open(path, 'w', encoding='utf-8', newline='').write(t)
    print(f'  {path}: helper updated')
print('ok')
