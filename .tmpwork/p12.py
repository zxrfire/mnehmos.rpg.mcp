import io
p = 'src/engine/world/what-a-house-keeps-in-its-treasury.ts'
s = io.open(p, encoding='utf-8').read()
s = s.replace(""" * Which is also the honest reason a house's best sword and its four hundred
 * spears are not in the same place. Nobody decided that as a policy. One of
 * them is a thing you sign for and the others are a rack by the door.""",
""" * Which is also the honest reason a house's best sword and its four hundred
 * spears are not in the same place. Nobody decided that as a policy. One of
 * them is a thing you sign for and the others are a rack by the door. The same
 * split, said again about books: *"shitty books in the library, the valuable
 * books in the treasury."*
 *
 * A DEFAULT AND NOT A LAW. The owner: *"good ones in the treasury (for elders
 * to lend, you'd imagine, for example. NON EXHAUSTIVE, NOT STRICT)."* This is
 * where a thing sits when nothing has happened to it. Anything that has - a
 * furnace lent out, a blade taken down, a book somebody is holding - is
 * somewhere else, and the row already says so in `possessorId`. Nothing here
 * re-derives a location for a thing that has moved, and nothing enforces one.""")
io.open(p,'w',encoding='utf-8',newline='').write(s)
print('ok')
