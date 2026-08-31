/**
 * What the columns on the standing register mean.
 *
 * A reading aid rather than catalog data, which is why it lives here and not in
 * `data/cultivation/`. Every term below is a heading or a chip somewhere on the
 * sheet, and several are ordinary English words used in a narrower sense than
 * an operator would assume - `standing`, `stock` and `gate` especially. A panel
 * whose columns have to be explained somewhere else is a panel people misread.
 *
 * It renders first, above everything, for the same reason a key sits at the top
 * of a chart rather than the bottom.
 */

export interface GlossaryEntry {
    group: string;
    term: string;
    meaning: string;
}

export const GLOSSARY: readonly GlossaryEntry[] = [
    // ── the four columns on every dossier ──────────────────────────────
    {
        group: 'Reading a faction',
        term: 'Ordinal',
        meaning:
            'The realm of the strongest member who will actually answer: takes a challenge, walks a border, sits at a negotiation. It orders this whole sheet. It is never what a faction could field once at cost.'
    },
    {
        group: 'Reading a faction',
        term: 'Gate',
        meaning:
            'The minimum ordinal to be considered for admission at all. A gate of 0 means anyone who walks up. "Closed" means the faction takes no applicants under any circumstances.'
    },
    {
        group: 'Reading a faction',
        term: 'Ceiling',
        meaning:
            'What it could put in the world once, at cost, because something sealed under it is stronger than anything it can field day to day. Shown only where that exceeds the ordinal.'
    },
    {
        group: 'Reading a faction',
        term: 'Holds from',
        meaning:
            'Who issues its right to its vein. "Nobody" is a claim about power rather than paperwork, and most of this register holds on ground nobody granted.'
    },

    // ── governance ─────────────────────────────────────────────────────
    {
        group: 'Governance',
        term: 'Federated',
        meaning:
            'An apex holds the vein system, courts administer arterial veins on its behalf, and sects hold a single vein at sufferance on a renewable grant, paying tribute and disciples. There is a local sect to belong to and somebody nearby to petition.'
    },
    {
        group: 'Governance',
        term: 'Administered',
        meaning:
            'A power holds its territory itself. No client sects, no courts, no leases, nothing skimmed - and no feeder either, so it recruits directly. Joining a federated power means joining a sect; joining a direct ruler means being processed.'
    },
    {
        group: 'Governance',
        term: 'Deference',
        meaning:
            'Direct rule by respect. A small faction administers only what it can comfortably walk and holds a far larger zone because nobody is willing to find out what happens otherwise. The claim is worth what it was worth the last time it was tested, and beliefs decay.'
    },
    {
        group: 'Governance',
        term: 'Unassailable',
        meaning:
            'Holds the ground outright and pays nobody. Not a lease, not a claim, not a belief that could decay: the occupants are individually stronger than anything that could be sent, everyone has done the arithmetic, and nobody raises it.'
    },
    {
        group: 'Governance',
        term: 'Unbacked',
        meaning:
            'Holds no vein from anyone, answers to nobody, and pays for it continuously - which is the whole difference from unassailable. Each survivor has one specific reason it has not been absorbed, and usually that reason is that it has not been worth the trouble yet.'
    },
    {
        group: 'Governance',
        term: 'Outside',
        meaning:
            'Holds no vein by nature. The Dao houses sell services instead - arbitration, verification, survey, the register of names. They are not in the pyramid and cannot be evicted from it.'
    },

    // ── standing ───────────────────────────────────────────────────────
    {
        group: 'Standing',
        term: 'Good',
        meaning: 'The grant is renewed without discussion, and has been for a long time.'
    },
    {
        group: 'Standing',
        term: 'Strained',
        meaning: 'The grant is under pressure. Renewal is no longer a formality and both parties know it.'
    },
    {
        group: 'Standing',
        term: 'Probationary',
        meaning:
            'The grant is conditional on behaviour. The next renewal is the live question, and the faction is behaving accordingly.'
    },
    {
        group: 'Standing',
        term: 'Not applicable',
        meaning: 'The faction holds from nobody, so there is no grant for it to be in good standing on.'
    },

    // ── the top of the world ───────────────────────────────────────────
    {
        group: 'The last realm',
        term: 'Apex',
        meaning:
            'A faction that received something from an ascended founder AND can hold it. The second half is the whole test - provenance alone does not make one.'
    },
    {
        group: 'The last realm',
        term: 'Sent down',
        meaning:
            'What that founder sent back through the Lid. Permanent, unreproducible, and the reason the apex is an apex.'
    },
    {
        group: 'The last realm',
        term: 'Second seat',
        meaning:
            'The ordinal of the strongest member after the pinned one. The gap between them is the honest measure of how deep a position goes.'
    },
    {
        group: 'The last realm',
        term: 'Stock',
        meaning:
            'How much of the founder\'s divestment is left, from spent to nearly intact. Age runs backwards here: an ancient faction has depth of position and an empty storehouse, a young one the reverse.'
    },
    {
        group: 'The last realm',
        term: 'Withdrawn',
        meaning:
            'Awake, unsealed, at full strength, and effectively never present. Distinct from pinned, which cannot leave, and from sealed, which cannot act at all without being spent.'
    },

    // ── channels ───────────────────────────────────────────────────────
    {
        group: 'Channels',
        term: 'Answering channel',
        meaning:
            'Somebody above the Lid still picks up, and sends objects or accounts back down. This, rather than vein wealth, is the real hierarchy of the world.'
    },
    {
        group: 'Channels',
        term: 'Personal channel',
        meaning: 'A line to one named person rather than to a lineage. It works for as long as they answer.'
    },
    {
        group: 'Channels',
        term: 'Parting gift',
        meaning:
            'No line at all. What is held is what was left behind on the way out, and there is nobody to call.'
    },
    {
        group: 'Channels',
        term: 'Depletion',
        meaning:
            'How drawn down the correspondence is. Light means it still answers readily; heavy means longer gaps and thinner returns.'
    },

    // ── seals ──────────────────────────────────────────────────────────
    {
        group: 'Seals',
        term: 'Crude',
        meaning:
            'Cheap to raise and expensive to keep. Burns vein output continuously and cannot be hidden, because the numbers do not add up and anyone auditing sees it. Holds the bottom of the band.'
    },
    {
        group: 'Seals',
        term: 'Sound',
        meaning: 'The ordinary standard, and the ordinary reason a sect is poor.'
    },
    {
        group: 'Seals',
        term: 'Masterwork',
        meaning:
            'Built by somebody who is no longer available. Draws almost nothing, has not been serviced in centuries, and is invisible - which is why nobody can say which quiet mountain has something under it.'
    },

    // ── the four people groups ─────────────────────────────────────────
    {
        group: 'People',
        term: 'Active',
        meaning: 'Alive, in the faction, and can be met.'
    },
    {
        group: 'People',
        term: 'Sealed',
        meaning:
            'Alive, and cannot act without being spent. A break-glass asset with a stated trigger and a stated cost, generally not survived.'
    },
    {
        group: 'People',
        term: 'Ascended',
        meaning:
            'Through the Lid and gone. Nothing crosses except the cultivator, so what they left behind is the whole of what the faction still has of them.'
    },
    {
        group: 'People',
        term: 'Terminal',
        meaning:
            'Dead or lost. The line stops there, and the entry exists because what they did still shapes the faction.'
    }
];

/** The groups in render order, each with its entries. */
export function glossaryGroups(): { group: string; entries: GlossaryEntry[] }[] {
    const order: string[] = [];
    const byGroup = new Map<string, GlossaryEntry[]>();
    for (const entry of GLOSSARY) {
        if (!byGroup.has(entry.group)) {
            byGroup.set(entry.group, []);
            order.push(entry.group);
        }
        byGroup.get(entry.group)!.push(entry);
    }
    return order.map(group => ({ group, entries: byGroup.get(group)! }));
}
