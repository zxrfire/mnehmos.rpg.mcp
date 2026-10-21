/** An honorific changes how a person is addressed, not who they are related to. */
const ADDRESS = /^(?:(?:my|our|the)\s+)?(?:grandma|grandmother|grandpa|grandfather|auntie|aunt|uncle|senior brother|senior sister|junior brother|junior sister|elder|senior|master|sister|brother)\s+(.+)$/i;
const nameKey = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** Undefined is no address; null is an absent or ambiguous actual name. */
export function personNamedByAddress<T extends { name: string }>(query: string, people: readonly T[]): T | null | undefined {
    const address = ADDRESS.exec(query.trim());
    if (!address) return undefined;
    const wanted = nameKey(address[1]);
    const exact = people.filter(person => nameKey(person.name) === wanted);
    if (exact.length === 1) return exact[0]!;
    const matches = people.filter(person => {
        const name = nameKey(person.name);
        return name.startsWith(wanted + ' ') || name.endsWith(' ' + wanted);
    });
    return matches.length === 1 ? matches[0]! : null;
}
