# Créditos de assets

Todo lo que BLOCKSHOT usa y no está hecho en este repositorio, con su origen y su licencia.
Los modelos se guardan como GLB comprimidos con meshopt.

## Modelos 3D

| Asset                          | Autor      | Fuente                                                                                                  | Licencia                  | Dónde se usa                      |
| ------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------- | ------------------------- | --------------------------------- |
| Ultimate Gun Pack (julio 2019) | Quaternius | https://opengameart.org/content/low-poly-guns-pack (también https://quaternius.itch.io/50-lowpoly-guns) | CC0 1.0 (dominio público) | `client/public/models/guns/*.glb` |

Modelos del pack que se usan, convertidos de OBJ a GLB (obj2gltf) y comprimidos (gltf-transform meshopt):

| Arma del juego     | Archivo                                   | Modelo original                                                                                            |
| ------------------ | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Fusil              | `rifle.glb`                               | AssaultRifle2_1                                                                                            |
| Francotirador      | `sniper.glb`                              | SniperRifle_3                                                                                              |
| Fusil de tirador   | `dmr.glb`                                 | SniperRifle_4                                                                                              |
| Escopeta           | `shotgun.glb`                             | Shotgun_1                                                                                                  |
| Subfusil           | `smg.glb`                                 | SubmachineGun_2                                                                                            |
| Ametralladora      | `lmg.glb` + `bipod.glb`                   | AssaultRifle_2 + Accessories/Bipod                                                                         |
| Pistola            | `pistol.glb`                              | Pistol_1                                                                                                   |
| Revólver           | `revolver.glb`                            | Revolver_1                                                                                                 |
| Pistola automática | `mpistol.glb`                             | SubmachineGun_4                                                                                            |
| Recortada          | `sawedoff.glb`                            | Shotgun_SawedOff                                                                                           |
| Lanzagranadas      | `launcher-body.glb` + `launcher-tube.glb` | Shotgun_ShortStock + Accessories/Silencer_3 (montados en el juego: el silenciador ensanchado hace de tubo) |

Modelos sueltos de Poly Pizza (https://poly.pizza), cada página marcada «Public Domain (CC0)», descargados el
2026-10-28. Quaternius cambió en 2026 la licencia de su web; estas copias se obtuvieron como CC0 en Poly Pizza.
Convertidos a GLB con meshopt.

| Asset              | Autor      | Página                                                                                              | Dónde se usa                                                                          |
| ------------------ | ---------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Knife              | Quaternius | https://poly.pizza/m/N9bfPFP1hr                                                                     | `client/public/models/guns/knife.glb` (cuchillo)                                      |
| Grenade            | Quaternius | https://poly.pizza/m/xnuUzBTsUg                                                                     | `client/public/models/props/grenade.glb`                                              |
| Landmine           | Quaternius | https://poly.pizza/m/PtqkseZo9O                                                                     | `client/public/models/props/mine.glb` (habilidad Mina)                                |
| Sack Trench        | Quaternius | https://poly.pizza/m/LW3jwpPfiN                                                                     | `client/public/models/props/sacks.glb` (habilidad Muro y sacos terreros de los mapas) |
| Smoke Grenade West | Pichuliru  | https://poly.pizza/m/GbhfKcTiF9                                                                     | `client/public/models/props/smokegren.glb` (habilidad Humo)                           |
| Crate (×2)         | Quaternius | https://poly.pizza/m/NlXe0ZJGUd · https://poly.pizza/m/SfJtdV8GDr                                   | `client/public/models/world/q-crate*.glb`                                             |
| Pallet             | Quaternius | https://poly.pizza/m/cUAsYHDqfD                                                                     | `client/public/models/world/q-pallet.glb`                                             |
| Car, Car, SUV      | Quaternius | https://poly.pizza/m/Cz6yDaUcM9 · https://poly.pizza/m/unqqkULtRU · https://poly.pizza/m/xsMtZhBkxL | `client/public/models/world/q-car-*.glb`                                              |
| Street Light       | Quaternius | https://poly.pizza/m/nFwrlcLvM5                                                                     | `client/public/models/world/q-lamp.glb`                                               |

Kits de Kenney (https://kenney.nl), CC0 1.0, descargados de las páginas que el propio Kenney publica en OpenGameArt.
Los GLB llevan su textura (`colormap.png`) incrustada, reducida a 256 px, y comprimidos con meshopt
(`client/public/models/world/`, prefijo según el kit):

| Kit                       | Página                                              | Modelos                                                                                                            |
| ------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| City Kit (Industrial) 2.0 | https://opengameart.org/content/city-kit-industrial | `i-*`: contenedores, fábricas, chimenea, depósito                                                                  |
| City Kit (Commercial) 2.1 | https://opengameart.org/content/city-kit-commercial | `c-*`: rascacielos y bloques del fondo                                                                             |
| City Kit (Suburban) 2.0   | https://opengameart.org/content/city-kit-suburban   | `u-*`: casas alrededor del Patio                                                                                   |
| City Kit (Roads) 2.2      | https://opengameart.org/content/city-kit-roads      | `r-*`: farola, contenedor de basura, señalización de obra                                                          |
| Survival Kit              | https://opengameart.org/content/survival-kit        | `s-*`: barril, rocas de arena, árboles, valla                                                                      |
| Nature Kit 2.1            | https://opengameart.org/content/nature-kit          | `n-*`: árboles, pinos, cactus, rocas, troncos apilados y tienda de campaña (colores retocados en `worldModels.ts`) |

## Efectos y texturas

| Asset                                                                                                                                                                                                                    | Autor     | Fuente                                                   | Licencia | Dónde se usa                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | -------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------- |
| Smoke Particles                                                                                                                                                                                                          | Kenney    | https://opengameart.org/content/smoke-particle-assets    | CC0 1.0  | `client/public/fx/fx.png`: humo, fuego, humo negro, nubes                                 |
| Particle Pack                                                                                                                                                                                                            | Kenney    | https://opengameart.org/content/particle-pack-80-sprites | CC0 1.0  | `client/public/fx/fx.png`: fogonazo (star_09), destellos, polvo, gotas                    |
| Blood Splatter                                                                                                                                                                                                           | ExileGL   | https://opengameart.org/node/52811                       | CC0 1.0  | `client/public/fx/fx.png`: dos manchas de sangre recortadas con una máscara redonda       |
| Texturas PBR (solo el mapa de color): Bricks005, Plaster007, Concrete034, PavingStones128, Asphalt031, Ground080, Rock058, Planks037A, WoodFloor051, CorrugatedSteel009, DiamondPlate008C, Tiles139, Gravel043, Grass004 | ambientCG | https://ambientcg.com                                    | CC0 1.0  | `client/public/textures/*.jpg`, pasadas a gris claro (el color lo pone cada mapa), 512 px |

## Hecho en el proyecto

- Personajes, caras (skins), camuflajes y acabados de arma: geometría y texturas generadas por código
  (`client/src/game/render/models.ts`, `client/src/game/render/gunAssets.ts`).
- Las mangas de los brazos en primera persona (siguen el uniforme del personaje) y las texturas de mapa sin
  equivalente en los packs: fachadas con ventanas, paneles de hormigón, chapa pintada, persianas, toldos y
  franjas de peligro (`client/src/game/render/world.ts`).
- Logo e iconos de marca: aportados por el autor del juego (`client/public/brand/`, `client/public/logo.png`).
- Capturas de los mapas (`client/public/maps/*.jpg`): renders del propio juego.

## Tipografías

| Fuente        | Autor                         | Fuente                                          | Licencia                  |
| ------------- | ----------------------------- | ----------------------------------------------- | ------------------------- |
| Black Ops One | James Grieshaber (Astigmatic) | https://fonts.google.com/specimen/Black+Ops+One | SIL Open Font License 1.1 |
| Chakra Petch  | Cadson Demak                  | https://fonts.google.com/specimen/Chakra+Petch  | SIL Open Font License 1.1 |
