---
version: 1
slug: 'src-lobby-lobby-tsx'
primary_target: 'src/lobby/Lobby.tsx'
related_targets: ['src/characters/CharacterSelect.tsx']
---

Scope: BLOCKSHOT lobby and character select (Operate). Phase 1 = navigable proposal only; implementation waits for the user's OK.

Audience/job: classmates get into a match within a minute, without explanation: pick a name, join or create a room (optional password), see who is in and whether they are ready, pick a character and skin.

## Direction contract

THESIS: The category standard played straight: a serious tactical-shooter front end at Valorant / CS2 / Urban Terror craft. Refuses the current asymmetric config-panel lobby and the toy-like flat slate kit.

OWN-WORLD: Near-black ink grounds with one cool or warm undertone per palette option, hairline 1px rules, square corners (2px max), tall condensed uppercase display (Saira Condensed) over a squared sans (Saira), tabular numerals. One action colour that never collides with team red and team blue; green only means ready.

STORY: The player sees two equal halves, joins or creates in one click, sees the room's roster by team with ready marks, then meets their character turning in a lit studio with comparable stats and skins.

FIRST VIEWPORT: Top bar (logo left, name centre, Ranking/Manual/Ajustes right). Below, two equal columns: Unirse (room table, selected room roster split rojo|azul, password when locked, Entrar / Estoy listo bottom-right) and Crear sala (map photos, modes, rules, password, Crear sala bottom-right).

FORM: canon (user exit), references Valorant, CS:GO/CS2, Urban Terror; seed:3b218a849d3ff1dc

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
