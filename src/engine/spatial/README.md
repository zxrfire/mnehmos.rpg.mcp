<!-- tier: 3 -->

# Spatial

A* with line of sight, and the min-heap that makes the first cheap.

Retained from the D&D substrate, where it pathed a battle grid, and **kept for
folding space**. The design owner: *"void refinement cultivators can do it"*.

`fold` is already a verb and
`engine/world/how-far-somebody-can-fold-space-and-what-it-costs.ts` already
prices one, but what it prices is a jump between two named places with nothing
saying which places a fold can reach THROUGH. That is a cheapest-path question
over a graph with costed edges and closed nodes, which is what `engine.ts` is.

**And be honest about the gap before reaching for it.** What is here is GRID A*:
it takes `Point` and `TerrainCostMap` and thinks in tiles, and this world is a
region graph with roads between named places. The algorithm transfers and the
data model does not. Adapting it means swapping the coordinate pair for a place
id and the terrain map for road costs; `heap.ts` transfers untouched, because a
priority queue does not care what it is ordering.

It was deleted once on the grounds that nothing reaches it, and put back within
the hour on the grounds above. If you are looking at it again and wondering: it
is waiting for the fold path, not for a grid.

Retained from the D&D substrate, where it pathed a battle grid, and **kept for
folding space**. The design owner: *"void refinement cultivators can do it"*.

That is the reading that makes this worth having. `fold` is already a verb, and
`engine/world/how-far-somebody-can-fold-space-and-what-it-costs.ts` already
prices one - but what it prices is a jump between two places, with nothing that
says which places a fold can REACH THROUGH. A cultivator folding across a
province is solving exactly the problem in `engine.ts`: cheapest path over a
graph whose edges have costs, with some nodes closed to them. The grid it was
written for is gone; the algorithm is the same algorithm.

Nothing in `src/web/` reaches it yet, and its four test files are the only
callers. It was deleted once in this repo's history for that reason and put back
within the hour, on the grounds above - so if you are looking at it again and
wondering, the answer is that it is waiting for the fold path and not for a
grid.

| file | what it is |
|---|---|
| [`engine.ts`](./engine.ts) | - |
| [`heap.ts`](./heap.ts) | Min-heap implementation for efficient priority queue operations in A* pathfinding. |
