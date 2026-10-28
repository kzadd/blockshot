# Sketch brief (shared by every card)

Write ONE self-contained HTML file: the first viewport of BLOCKSHOT's LOBBY in this card's visual direction.

## Hard format rules

- Exactly 1440 x 900: `html,body{width:1440px;height:900px;overflow:hidden;margin:0}`.
- Inline CSS only, NO JavaScript, nothing fetched except Google Fonts (`<link>` to fonts.googleapis.com is fine). No images: draw map thumbnails as flat coloured blocks / simple CSS shapes (a tiny top-down plan made of divs is great).
- Under 200 lines. Spanish UI copy. Valid HTML.
- Do NOT use these overused fonts: Fraunces, Playfair Display, Cormorant, Lora, Crimson, Newsreader, Syne, Space Grotesk, Space Mono, IBM Plex, Inter, DM Sans, DM Serif, Outfit, Plus Jakarta Sans, Instrument Sans. Pick faces that belong to the direction's world.
- No gradients-as-decoration, no glassmorphism, no generic icon tiles, no many-vertex clip-path polygons.

## What the product is

BLOCKSHOT: a Krunker-style first-person block shooter played by university classmates (adults 25+) over the classroom LAN. One student's PC is the server; everyone opens `blockshot.local:3000` in Chrome on modest laptops. Interface in Spanish.

## Surface: the lobby (an Operate surface)

The world lends ONLY type, palette, density and ONE signature move. Layout, navigation and controls stay standard web controls (buttons, inputs, tabs, lists) a gamer already knows. It must read as a game lobby first, the world second. Clean aligned grid, real type scale, clear hierarchy.

The lobby must be SYMMETRIC, clean and understood without explanation:

- Logo "BLOCKSHOT" and your nickname field ("Tu nombre", filled with "Ricardo").
- Two equal halves: **Unirse a una sala** and **Crear sala**.
- Room list (synthetic demo data, realistic):
  1. "Sala de Ricardo" · Patio · Todos contra todos · 5/12 jugadores · EN JUEGO · abierta
  2. "Clase 3B" · Almacén · Por equipos · 6/10 · EN ESPERA · 4 de 6 listos · abierta
  3. "Torneo viernes" · Desfiladero · Todos contra todos · 3/8 · EN ESPERA · con contraseña (lock)
- A selected room shows its connected players with ready state (listo / no listo) — e.g. Clase 3B: Ana (listo, rojo), Bea (listo, azul), Cris (no listo, rojo), Dani (listo, azul), Eva (listo, rojo), Fran (no listo, azul). Password field appears for locked rooms. Primary action: "Entrar" / "Estoy listo".
- Create half: map choice (6 maps: Patio, Almacén, Desfiladero, Polvo, Ciudad, Obra), mode (8 modes: Todos contra todos, Por equipos, Captura la bandera, Escalada de armas, Confirmar bajas, Infectados, Dominio, Rondas), optional password, "Crear sala".
- Top-right secondary: Ranking, Manual, Ajustes.
- Teams are ROJO and AZUL; they must be clearly distinguishable from each other and from the action colour.
- Physical scene: classroom in daytime under fluorescent light, laptops on desks (let this decide light vs dark unless the direction says otherwise).

Put the card's signature move somewhere a user would notice it at thumbnail size, without hurting clarity.
