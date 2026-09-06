import io

# ── seed a plate and a token for every member at or above the rung ──────
p = 'src/engine/world/what-a-house-keeps-in-its-treasury.ts'
s = io.open(p, encoding='utf-8').read()

s = s.replace("import { purposeOf, type RoomPurpose } from './architecture.js';",
"import { purposeOf, type RoomPurpose } from './architecture.js';\n"
"import {\n"
"    WHERE_THE_PLATES_HANG,\n"
"    carriesATokenAt,\n"
"    issueTo\n"
"} from './a-house-knows-its-own-by-a-plate-and-a-token.js';")

old = """        out.push(...whatElseTheHouseKeeps(house.id, name, roomFor, acting, today));
    }

    return out;
}"""
new = """        out.push(...whatElseTheHouseKeeps(house.id, name, roomFor, acting, today));

        // ── AND WHO IT KNOWS BY NAME ─────────────────────────────────────
        //
        // A plate on the wall for every disciple and a token in their hand.
        // `docs/world/houses/trust.md` has carried the whole design under its
        // own heading since it was written and NOTHING in the engine ever made
        // one - `'token'` was a value of `ObjectKind` that nothing produced.
        //
        // Issued from the rung a house starts putting its name on somebody,
        // which is the first rung that is a disciple rather than a servant.
        const plateRoom = roomFor(WHERE_THE_PLATES_HANG);
        for (const member of state.npcs) {
            if (member.factionId !== house.id) continue;
            if (member.status !== 'alive') continue;
            if (!carriesATokenAt(member.factionRankIndex)) continue;
            const issued = issueTo({
                memberId: member.id,
                memberName: member.name,
                houseId: house.id,
                houseName: name,
                plateRoomId: plateRoom,
                onDay: today
            });
            out.push(issued.token, issued.plate);
        }
    }

    return out;
}"""
assert old in s, 'seed loop tail not found'
s = s.replace(old, new, 1)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
