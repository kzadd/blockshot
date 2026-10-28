# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

University classmates (adults, 25+) who play together in class over the local network, in short sessions between or during lessons. One of them (the organiser) runs the server on their own PC and is the room admin; everyone else joins from a browser.

## Product Purpose

BLOCKSHOT is a Krunker-style first-person arena shooter built from blocks, made to be played in class with no install: the host runs `pnpm clase` and shares `http://blockshot.local:3000`. Success: everyone is in a match within a minute, understands the screen without explanation, and wants another round.

## Positioning

A self-hosted LAN shooter for one classroom: the host's PC is the authoritative server, rooms, ranking and tournaments live on that PC, and the whole game (models, sounds) is generated in code. It is a group ritual for people who know each other, not a public matchmaking game.

## Operating Context

- Played on modest laptops with integrated graphics (Intel/AMD iGPU), in Chrome, on classroom wifi.
- Sessions: create or join a room (optional password), pick a character, play modes (FFA, teams, CTF, Domination, gun game, infected, rounds), vote the next map, league tournaments, all-time ranking saved in a local JSON file.
- The admin (the server PC) can kick, kill, switch team, restart, change map/mode, lock the room and add practice bots.

## Capabilities and Constraints

- Gameplay and network logic must not change without asking the user. Hitboxes and colliders stay simple shapes; visuals are separate from collision.
- Performance first: must run smoothly on integrated graphics. Low-poly, instancing, compressed GLB (Draco/Meshopt, KTX2) if external assets are used; heavy effects need a quality switch.
- External assets only with free licences (CC0 or CC-BY: Kenney, Quaternius, Poly Haven, ambientCG, Mixamo), one coherent style, credited in `ASSETS_CREDITS.md`. Ask before generating or improvising missing assets.
- 7 characters (Soldado, Cazador, Tanque, Rayo, Bastión, Explorador, Artillero), each with a primary, a sidearm, a knife and one ability (key E); 10 skins; outfit colours from a fixed palette; 6 maps.
- Undecided: a ready / not-ready waiting room before a match (today players join a match in progress). It is a network change; the user decides after seeing the proposal.

## Brand Commitments

- Name: BLOCKSHOT. Interface language: Spanish.
- The current «Kit de campo» look (Claude Design) is replaceable: it is evidence, not a commitment.
- Standing preference (2026-10-27): the category standard, played straight. BLOCKSHOT must look like a serious tactical shooter alongside Valorant, CS:GO/CS2 and Urban Terror; their craft level is the bar. Concept worlds (board games, sticker albums, station boards, mascot catalogues) were shown and rejected as "feos".

## Evidence on Hand

- Current client: `client/src` (lobby, character select, HUD, renderer). Map aerial screenshots: `client/public/maps/*.jpg`.
- Earlier design references: `../capturas-para-claude-design/`, Claude Design project «Kit de campo».
- No external 3D assets yet; everything is procedural.

## Product Principles

1. Understood without explanation: a classmate who never played must get into a match unaided.
2. Readability beats spectacle in combat: enemies, team and HUD state must read instantly.
3. Runs on the weakest laptop in the room.
4. Fun and feedback first: every hit, kill and round should feel good.
5. The host stays in control: admin tools are always at hand but never in the way of players.
