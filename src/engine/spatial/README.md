<!-- tier: 3 -->

# Spatial

`SpatialEngine` paths both tile grids and named places. `findGraphPath` uses
the shared min-heap to find the cheapest route over caller-supplied edges.
Nonnegative finite costs are traversable; an omitted edge is closed.

`regions/the-map.ts` calls it for place and province roads. Those reads reach
walking journeys, paid travel, and folding-space range checks through
`GameService.daysOnTheRoadTo`. Road costs remain the catalog's walking days;
folding changes how the journey is made, not the distance it covers.

The retained grid methods supply tile distance, line of sight and area shapes.
They share the class and heap but do not invent coordinates for named places.

- [`../../data/cultivation/regions/the-map.ts`](../../data/cultivation/regions/the-map.ts) supplies the live place and province graph.
- [`../world/how-far-somebody-can-fold-space-and-what-it-costs.ts`](../world/how-far-somebody-can-fold-space-and-what-it-costs.ts) prices the fold from walking days.
