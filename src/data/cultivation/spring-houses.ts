/** The two permanent houses at the Sands' fixed water; their authority ends at that water. */
import type { SectEntry } from './sects.js';
import { PLACE } from './place-names.js';

export const SPRING_HOUSES: readonly SectEntry[] = [
    {
        id: 'sect-moonwater', name: 'Moonwater Sect', alignment: 'neutral', powerOrdinal: 21,
        ranks: ['Water Servant', 'Outer Disciple', 'Inner Disciple', 'Spring Elder', 'Grand Spring Elder', 'Sect Master'],
        admissionOrdinal: 0, stipend: [2, 6, 18, 60, 120, 200],
        teaches: ['lesser-qi-gathering-manual', 'five-breath-circulation-scripture', 'warm-current-qi-transfer'],
        signatureTechniqueId: 'warm-current-qi-transfer', specialities: ['support', 'cultivation'],
        rivals: [], territory: 'Truce Spring and the painted rock above its water.', seatPlaceName: PLACE.SAND_WELL, recruits: true,
        compound: { inherited: true, formationNodesTotal: 12, formationNodesLit: 4,
            remnant: 'Meditation cells cut into fixed rock above the spring. Donors are painted on the walls.' },
        description: 'The keepers of Truce Spring occupy meditation cells cut into the fixed rock above its water. Four of the twelve inherited formation nodes still burn. Their elders claim a western-road grant issued before the road closed; the issuer has no surviving office, and no living reader has confirmed an unbroken succession. Ochre Cliff carries painted donors from several generations, with older names scraped beneath the later paint. Painted Scroll Grotto remains warded above it. The house receives travellers at a gate facing the spring, and food sellers and an inn stand outside its wall. Its elders claim the water and the rock, leaving the moving dunes and their shows unclaimed.',
        ambition: { wants: 'Recognition of the old western-road grant as authority over the fixed spring.', blockedBy: ['sect-azure-cloud-pavilion'],
            wouldCost: 'Opening the warded archive, finding a reader of the western script and submitting the recovered copy and the succession records for examination.', contestedWith: [],
            movedOn: 'The elders have named the archive as their evidence, but its ward has not been opened.' }
    },
    {
        id: 'sect-five-grains', name: 'Five Grains Sect', alignment: 'neutral', powerOrdinal: 19,
        ranks: ['Granary Servant', 'Outer Disciple', 'Inner Disciple', 'Ledger Elder', 'Grand Ledger Elder', 'Sect Master'],
        admissionOrdinal: 0, stipend: [2, 5, 15, 45, 90, 160],
        teaches: ['lesser-qi-gathering-manual', 'iron-shirt-tempering', 'five-breath-circulation-scripture'],
        signatureTechniqueId: 'iron-shirt-tempering', specialities: ['defense', 'cultivation'],
        rivals: [], territory: 'The granaries beside Truce Spring.', seatPlaceName: PLACE.SAND_WELL, recruits: true,
        compound: { inherited: true, formationNodesTotal: 8, formationNodesLit: 3,
            remnant: 'Dry granaries and an account room on the spring rock.' },
        description: 'The granaries of Five Grains Sect stand on the fixed rock beside Truce Spring. Its elders keep grain accounts and written seasonal contracts in an inherited account room, with three of eight formation nodes still lit. The ranks name the work: servants carry grain, disciples keep the stores, and ledger elders answer for the accounts. The house teaches circulation and bodily tempering rather than a road across the dunes. Its elders have asked the spring keepers to admit a grain factor to their account room, offering a season of supplies before repayment. The two houses share the water approach and keep separate gates and rolls. Five Grains claims its granaries and their rock; it has no claim on a moving show beyond them.',
        ambition: { wants: 'A grain factor admitted to the spring keepers\' account room.', blockedBy: ['sect-moonwater'],
            wouldCost: 'Supplying a season of grain before repayment and presenting the accounts for the spring keepers to examine.', contestedWith: [], movedOn: 'The elders have asked for a hearing and named the grain factor they want admitted.' }
    }
];
