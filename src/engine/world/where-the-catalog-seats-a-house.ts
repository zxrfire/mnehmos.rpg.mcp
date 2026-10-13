/** The world's existing physical placement, separate from political jurisdiction. */
export function houseSeatRegions(regions: readonly { id: string; factionIds: readonly string[] }[]): (houseId: string) => string | null {
    const regionForFaction = new Map<string, string>();
    for (const region of regions) {
        for (const id of region.factionIds) regionForFaction.set(id, region.id);
    }
    return houseId => regionForFaction.get(houseId) ?? regions[0]?.id ?? null;
}
