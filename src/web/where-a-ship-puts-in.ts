/**
 * Where a ship puts in: every lane's landfalls, and every place on open water, each at its own dock.
 *
 * The owner: "all island places have a dock". So nothing on open water is walked to, and nothing
 * is hand-listed: a dock is every place the world stands directly on a province that is open water
 * (`openWater` in the catalog), a house's grounds and a ruin as much as a port town, and without a
 * world the catalog's own places there. A room inside a house's walls is reached through the dock
 * of the ground it stands in.
 *
 * How far apart two docks are is the catalog's chain of passages between them (`placeRoadDays`).
 * A dock only the world knows (a house's grounds, a ruin, the vein) has no passages of its own,
 * so it is a day out from the catalog port nearest it ({@link thePortADockIsNear}) and takes that
 * port's days plus the one. Two catalog places no chain joins are the flat unpriced day apart.
 */

export { theProvinceOf, thePortsShipsPutInAt, theDockOf, thePortADockIsNear, daysOfSailingBetween, theLandfall } from '../engine/world/public-shipping.js';
