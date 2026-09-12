<!-- tier: 3 -->

# The rules DSL

A small expression language for authored rules.

| file | what it is |
|---|---|
| [`engine.ts`](./engine.ts) | - |
| [`parser.ts`](./parser.ts) | - |
| [`schema.ts`](./schema.ts) | - |

---

## Where else to look

- [`../../schema/README.md`](../../schema/README.md) - the shapes a rule is written against.
  A rule that can name a field the schema does not have is a rule that fails at run time.
- [`../worldgen/README.md`](../worldgen/README.md) - `engine.ts` evaluates against a
  `GeneratedWorld` and calls `validateStructurePlacement` /
  `getSuggestedBiomesForStructure`. That coupling is the whole of what this DSL is currently
  used for, and it is not obvious from the name.
- [`../../server/README.md`](../../server/README.md) - `terrain-patterns.ts` there is the other
  end: authored placement rules reaching the tool surface.
- [`../../math/README.md`](../../math/README.md) - `dice.ts` and `schemas.ts`
  (`DiceExpression`) are the other small expression language in this repo. Check before adding
  arithmetic here.
- [`../cultivation/README.md`](../cultivation/README.md) - **rules about cultivation are not
  authored in this DSL.** They are TypeScript there, on purpose: the engine decides, and a
  decision behind an interpreter is harder to test than one in a function.

