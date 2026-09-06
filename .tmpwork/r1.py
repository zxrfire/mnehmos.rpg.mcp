import io

p = 'src/web/a-sentence-can-be-more-than-one-call.ts'
s = io.open(p, encoding='utf-8').read()
old = """        : `Picking the ${selection.word} one is a comparison this turn has nothing to make: `
          + `${selection.field === 'price' ? 'a price board' : 'a set of places'} is what would `
          + 'carry it, and nothing here is holding one. Ask for that first and then choose.';"""
new = """        // NO BOARD. The design owner: *"a player can't actually see the market
        // board. There's a sect task board, but a market board is theirs to
        // make a mental of, not to conserve - so they know how much something
        // costs."* A market is people at counters, and what a price costs you
        // is having asked. The one board a player can walk up to is the house's
        // own, and telling them to find another sends them looking for a thing
        // that is not there. `market-prices.ts` may go on calling its rows a
        // board among themselves; nothing says it to a player.
        : `Picking the ${selection.word} one is a comparison this turn has nothing to make: `
          + `${selection.field === 'price' ? 'prices you have asked after' : 'a set of places'} `
          + 'is what would carry it, and you are not holding any. Ask first and then choose.';"""
assert old in s, 'choice refusal not found'
io.open(p, 'w', encoding='utf-8', newline='').write(s.replace(old, new, 1))

p2 = 'src/web/turn-engine.ts'
s2 = io.open(p2, encoding='utf-8').read()
old2 = """                        + `each = ${cost} stones. Priced through localPrice(${regionId}), the same call `
                        + 'the market board prices with.',"""
new2 = """                        + `each = ${cost} stones. Priced through localPrice(${regionId}), the same call `
                        + 'the market read prices with.',"""
assert old2 in s2, 'treat summary not found'
io.open(p2, 'w', encoding='utf-8', newline='').write(s2.replace(old2, new2, 1))
print('ok')
