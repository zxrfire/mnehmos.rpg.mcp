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
