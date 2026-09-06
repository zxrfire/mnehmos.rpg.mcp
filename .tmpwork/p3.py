import io
p = 'src/engine/world/what-a-house-keeps-in-its-treasury.ts'
s = io.open(p, encoding='utf-8').read()
s = s.replace("import { sectThreat } from '../../data/cultivation/faction-relationships.js';\n", "")
s = s.replace("import { SECTS } from '../../data/cultivation/sects.js';",
              "import { SECTS, sectThreat } from '../../data/cultivation/sects.js';")
old = """        out.push(makeResourceLot({
            id: `cauldrons-plain-${house.id}`,
            name: 'fired clay cauldrons',
            quantity: howManyPlainCauldrons(acting),
            ownerId: house.id,
            ownerName: name,
            locationId: where,
            description:
                'The cauldrons a house hands out without writing anything down. They crack, '
                + 'they get replaced, and nobody has ever asked which one they were given.',
            tags: ['cauldron', 'treasury']
        }));"""
new = """        const plain = makeResourceLot({
            id: `cauldrons-plain-${house.id}`,
            resource: 'fired clay cauldrons',
            quantity: howManyPlainCauldrons(acting),
            source: `the ${name} stores`,
            acquiredOnDay: house.foundedOnDay ?? 0,
            holderId: house.id,
            holderName: name,
            how: 'crafted',
            // The one word that puts it on the counted side of the line.
            significance: 'mundane'
        });
        plain.ownerId = house.id;
        plain.ownerName = name;
        plain.locationId = where;
        plain.description =
            'The cauldrons a house hands out without writing anything down. They crack, they '
            + 'get replaced, and nobody has ever asked which one they were given.';
        plain.tags = ['cauldron', 'treasury'];
        out.push(plain);"""
assert old in s
s = s.replace(old, new)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
