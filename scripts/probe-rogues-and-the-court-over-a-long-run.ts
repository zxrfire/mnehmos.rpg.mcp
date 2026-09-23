import {
    REMOVED_FROM_OFFICE,
    theDayTheyLostTheOffice,
    theRemovalTheyCarry,
    theRoomWouldDealToThemAgain
} from '../src/engine/world/bringing-what-you-know-about-somebody-to-the-room.js';
            const highRogues: Record<string, number> = {};
            for (const n of rogues) {
                if (n.cultivation.realmOrdinal <= 29) continue;
                const src = n.tags.find(t => t.startsWith('rogue:'))?.split(':').slice(0, 2).join(':')
                    ?? (n.tags.some(t => t.startsWith('walked-out:')) ? 'walked-out'
                        : housesEver.has(n.id) ? 'left a roll' : 'never on a roll');
                const cameOffAt = n.tags.find(t => t.startsWith('came-off-a-roll-at:'));
                const stood = cameOffAt === undefined
                    ? null : Number(cameOffAt.slice('came-off-a-roll-at:'.length));
                const road = stood === null ? 'no roll to come off'
                    : stood > 29 ? 'minted at height' : `climbed from ${stood}`;
                const key = `${src} | ${road}`;
                highRogues[key] = (highRogues[key] ?? 0) + 1;
            }
            // DOES A ROOM EVER COME BACK TO SOMEBODY IT WAS TAKEN FROM. The
            // owner ruled the removal is not permanent and that influence is
            // what decides, so what has to be read is whether anybody ever
            // outgrows it: nobody ever means the weight is a gate in different
            // clothes, most of them inside a century means it costs nothing.
            const lostAnOffice = living.filter(n => n.tags.some(t => t.startsWith(REMOVED_FROM_OFFICE)));
            // AND HOW MANY OF THEM ARE STANDING SOMEWHERE ELSE NOW. The lookup
            // used to be keyed on the current house, so a person who lost an
            // office at one house and joined another carried a tag nobody could
            // find and the weight evaluated to zero. This is the count that says
            // whether that population exists at all, which it did not before the
            // doors opened.
            const carriedFromElsewhere = lostAnOffice.filter(n => {
                const carried = theRemovalTheyCarry(n);
                return carried !== null && carried.houseId !== n.factionId;
            }).length;
            const wouldBeDealtAgain: number[] = [];
            for (const n of lostAnOffice) {
                const house = state.factions.find(f => f.id === n.factionId);
                if (house === undefined) continue;
                if (!theRoomWouldDealToThemAgain(state, n, house, state.currentDay)) continue;
                const when = theDayTheyLostTheOffice(n);
                wouldBeDealtAgain.push(when === null ? 0 : Math.round((state.currentDay - when) / 365));
            }
            wouldBeDealtAgain.sort((a, b) => a - b);
            // HOW PEOPLE DIED, BY WHAT KILLED THEM AND WHERE THEY STOOD.
            //
            // Off `endNote` and `diedOnDay` on the row, which every path that
            // ends anybody writes through `markDead`, so nothing is counted
            // twice and nothing is missed by reading one template's facts. The
            // question this answers: did tonight's work shift death from
            // unmotivated to motivated, or did it just make the world safe.
            const bandOf = (o: number) => o < 13 ? 'a: mortal-ish <13'
                : o < 29 ? 'b: middle 13-28'
                    : o < 41 ? 'c: high 29-40' : 'd: apex 41+';
            const causeOf = (note: string) => {
                const t = note.toLowerCase();
                if (t.includes('lifespan exhausted')) return 'their span ran out';
                if (t.includes('old wound')) return 'a wound that never closed';
                if (t.includes('died of age')) return 'age (SHOULD NOT APPEAR)';
                if (t.includes('killed by')) return 'another cultivator or a beast';
                if (t.includes('taken when')) return 'a beast came down';
                if (t.includes('tribulation') || t.includes('crossing') || t.includes('wall')) return 'a wall or a crossing';
                if (t.includes('war') || t.includes('fell with') || t.includes('house')) return 'a war or a house falling';
                if (t === '') return 'nothing written';
                return `other: ${note.slice(0, 40)}`;
            };
            const deathsByBand: Record<string, number> = {};
            const deathsByCause: Record<string, number> = {};
            let deadInRun = 0;
            for (const n of state.npcs) {
                if (n.diedOnDay === null || n.diedOnDay === undefined) continue;
                if (theSpeciesItIs(n)) continue;
                deadInRun++;
                const band = bandOf(n.cultivation.realmOrdinal);
                const cause = causeOf(String(n.endNote ?? ''));
                deathsByBand[band] = (deathsByBand[band] ?? 0) + 1;
                deathsByCause[`${band} | ${cause}`] = (deathsByCause[`${band} | ${cause}`] ?? 0) + 1;
            }

            // AND HOW MANY OF THEM THE WORLD HAD TO REARRANGE ITSELF AROUND.
            // An age does not turn often: a tenth would convict the property.
            const deathFacts = state.history.facts.filter(f =>
                f.kind === 'death' || String(f.data?.pressure ?? '') === 'killing');
            const byScale: Record<string, number> = {};
            for (const f of deathFacts) byScale[f.scale] = (byScale[f.scale] ?? 0) + 1;
            const shook = (byScale.regional ?? 0) + (byScale.continental ?? 0) + (byScale.world ?? 0);

            const ords = living.map(n => n.cultivation.realmOrdinal);
            const pyramid: Record<string, number> = {};
            for (const o of ords) pyramid[bandOf(o)] = (pyramid[bandOf(o)] ?? 0) + 1;
            const live = state.factions.filter(f => f.dissolvedOnDay === null && isBelowTheLid(f));
            const standing: Record<string, string> = {}, raised: Record<string, string> = {};
            for (const kind of ['righteous', 'neutral', 'demonic', 'bloodline']) {
                const ofKind = [...catalogHouses].filter(([, k]) => k === kind).map(([id]) => id);
                const up = live.filter(f => ofKind.includes(f.id));
                standing[kind] = `${up.length}/${ofKind.length}`;
                let members = 0, once = 0;
                for (const n of living) {
                    if (n.factionId === null || !up.some(f => f.id === n.factionId)) continue;
                    members++;
                    if ((housesEver.get(n.id)?.size ?? 1) <= 1) once++;
                }
                raised[kind] = members === 0 ? '-' : (once / members).toFixed(3);
            }
            let onSeat = 0;
            for (const l of state.locations) if (l.kind === 'sect_seat') onSeat += npcsAt(state, l.id).length;
            const alive = state.npcs.filter(n => n.status === 'alive').length;
            const rate = (w: Record<string, number>, l: Record<string, number>) => Object.fromEntries(
                Object.keys(w).sort().map(k => [k, `${l[k] ?? 0}/${w[k]}`]));
                pyramid,
                deadInRun,
                deathsPerLivingHeadPerCentury: Number(
                    (deadInRun / Math.max(1, living.length) / Math.max(1, horizon / 100)).toFixed(3)),
                deathsByBand,
                deathsPerCenturyByBandAndCause: Object.fromEntries(
                    Object.entries(deathsByCause).sort()
                        .map(([k, v]) => [k, Number((v * 100 / horizon).toFixed(2))])),
                deathFactsByScale: byScale,
                earthShakingShare: deathFacts.length === 0
                    ? null : Number((shook / deathFacts.length).toFixed(3)),
                lostAnOffice: lostAnOffice.length,
                lostItAtAHouseTheyHaveSinceLeft: carriedFromElsewhere,
                andCouldHoldOneAgain: wouldBeDealtAgain.length,
                yearsToOutgrowIt: wouldBeDealtAgain.length === 0
                    ? null
                    : wouldBeDealtAgain[Math.floor(wouldBeDealtAgain.length / 2)],
