import io
p = 'src/engine/world/what-a-house-keeps-in-its-treasury.ts'
s = io.open(p, encoding='utf-8').read()
s = s.replace("        const roomFor = (purpose: RoomPurpose | null): string | null =>\n            (purpose === null ? null : rooms?.get(purpose) ?? null) ?? seat;\n        const where = seat;",
              "        const roomFor = (purpose: RoomPurpose | null): string | null =>\n            (purpose === null ? null : rooms?.get(purpose) ?? null) ?? seat;")
# A house does not CARRY things. Nobody is holding what is in a store.
s = s.replace("""                // NOBODY HOLDS IT UNTIL SOMEBODY IS LENT IT. That is the whole
                // distinction `whoseThisIs` reads: the house's id in both
                // fields is a thing sitting in a treasury, and a person's id in
                // the second is a thing somebody has been allowed to take out.
                possessorId: house.id,""",
"""                // NOBODY HOLDS IT UNTIL SOMEBODY IS LENT IT, and a house is
                // not somebody: a thing in a store is carried by NULL and is
                // in a room, which is what `whereThisThingActuallyIs` reports.
                // A person's id in this field is a thing somebody took out.
                possessorId: null,""")
s = s.replace("""                holderId: houseId,
                holderName: houseName,
                how: 'crafted',
                significance
            });
            lot.ownerId = houseId;""",
"""                holderId: null,
                holderName: houseName,
                how: 'crafted',
                significance
            });
            lot.ownerId = houseId;""")
s = s.replace("""            possessorId: houseId,
            ownerId: houseId,
            ownerName: houseName,
            power: null,""",
"""            possessorId: null,
            ownerId: houseId,
            ownerName: houseName,
            power: null,""")
s = s.replace("""            holderId: house.id,
            holderName: name,
            how: 'crafted',""",
"""            holderId: null,
            holderName: name,
            how: 'crafted',""")
io.open(p,'w',encoding='utf-8',newline='').write(s)
print('ok')
