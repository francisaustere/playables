# Roadmap : process de production des 10 templates

_François + Claude. Pas de calendrier pour l'instant (D7) : on avance étape par étape, et chaque étape se termine par une validation de François._

## Principe

Nos prompts sont des **documents de game design compressés** (5 500 caractères maximum chacun). Avant de les donner à Playables Builder, on les **bêta-teste avec Claude Code** : une session vierge reçoit uniquement ces prompts, construit le jeu, et liste tout ce qu'elle a dû deviner. Chaque supposition révèle un trou dans le doc, et on corrige jusqu'à ce que le jeu sorte juste du premier coup.

```
DA commune ─▶ Socle commun ─▶ Mécaniques par genre ─▶ Bêta-test Claude Code ─▶ Playables Builder
  (charte)     (common/ + T0)     (genres/ + prompts/)     (beta/, boucle de fix)     (après le kickoff)
```

État actuel : **tout le contenu existe en v0** (règles communes, Template 0, specs et prompts des 10 genres), rédigé par Claude. C'est une base de travail : chaque choix doit être validé à l'étape correspondante.

---

## Étape 1 : DA commune
**Objectif** : une charte neutre mais cohérente pour la famille des 10 templates, validée visuellement.
- [ ] Planche visuelle (page HTML) : palette par rôle, formes par rôle, typo, boutons, HUD, écrans Title / Paused / Result, effets de feedback, rendu en 9:16, 1:1 et 21:9
- [ ] Session de questions avec François : fond sombre ou clair, palette, langage de formes, niveau d'effets
- [ ] Mise à jour de `common/07-style-guide.md`, `game_spec.base.json` (style) et `common/08-audio.md` (kit de sons)
- **Livrable** : charte v1 validée.

## Étape 2 : Socle commun en détail
**Objectif** : des règles communes qu'un dev (ou Gemini) applique sans rien deviner.
- [ ] Passage en revue de `common/01` à `10`, une session de questions par bloc : SDK, game_spec, inputs, perf, mise en page, états, remix, QA
- [ ] Intégration des propositions issues de la rédaction des genres (voir « Questions ouvertes » ci-dessous)
- [ ] Prompts du Template 0 finalisés, puis **premier bêta-test** du Template 0 dans Claude Code : c'est aussi le test de la méthode
- [ ] Bloc commun du plan B réécrit à partir du socle validé
- **Livrable** : socle v1 et Template 0 qui tourne.

## Étape 3 : Mécaniques par genre
**Objectif** : pour chacun des 10 genres, une spec validée et des prompts qui en découlent.
- [ ] Une session de questions par genre sur `genres/NN/spec.md` : boucle de jeu, valeur de score, stage, contrôles, difficulté, cas limites
- [ ] Regénération des prompts p1 à p3 et vérification des limites (`npm run build`)
- Ordre proposé : 01 Runner (le modèle), puis 08 Bounce, 04 Platformer, 02 Arena, 03 Launch, 07 TD, 05 Grid, 06 Clicker, 09 Narrative, 10 Music
- **Livrable** : 10 specs v1 et leurs prompts.

## Étape 4 : Bêta-test dans Claude Code
**Objectif** : prouver que chaque séquence de prompts suffit à elle seule. Protocole dans `beta/README.md`.
- [ ] Pour chaque genre : une session Claude Code vierge, les prompts p1 → p2 → p3 collés un par un, un jeu jouable plus un `ASSUMPTIONS.md`
- [ ] Notation : mécaniques du SOW, checklist commune, critères d'acceptation, nombre de suppositions bloquantes
- [ ] Boucle : on corrige la spec et les prompts, puis on relance une session vierge (3 itérations au maximum par genre avant d'en reparler)
- **Livrable** : 10 jeux de référence, et des prompts « verts » : aucune supposition bloquante, toutes les mécaniques présentes.

## Étape 5 : Playables Builder (après l'accès du kickoff)
- [ ] Mesurer la vraie limite de caractères (et ajuster `config.json`), tester le remix (plan A ou B), adapter `game_spec` au schéma officiel
- [ ] Générer dans PB, faire la QA avec la checklist, journaliser dans `genres/NN/log.md`, soumettre
- Les jeux de référence de l'étape 4 servent d'étalon : quand PB s'en écarte, c'est un problème de PB ou de Gemini, pas du doc.

---

## Questions ouvertes (à trancher aux étapes 2 et 3)

**Socle (étape 2)**
- Catalogue de gestes : ajouter à `03-input.md` les gestes créés par les genres : `joystickLeft/Right`, `mouseAimRight`, groupes de touches en 4 directions, `button:<name>` / `touchButtons`, `cellTap`, `cellSwipe*`, `laneZone0-3`, `cardDrag`, `leftButton/rightButton`, `towerButton`, `upgradeButton`, `choiceButton`. Ou bien règle générale : « un genre peut déclarer ses gestes ».
- Convention de collision : collider = `look.size/2` (cercles) ou `look.w×h` (rectangles), sans clés de rayon séparées.
- Pièces sur grille : `look.size` en fraction de la case (Grid, TD).
- Sections ajoutées par les genres : `board`, `economy`, `card`, `stats`, `characters`, `endings`, `events`, `storylines`, `chart`. Faut-il une liste fermée ou ouverte ?
- Audio : `audio.play(name, when)` pour programmer un son à un instant précis (nécessaire au Music Tap).
- Input : `input.pressTime(action)`, l'horodatage exact de l'appui (Music Tap).
- Place disponible : les p1 en plan B sont à 5 128 à 5 491 caractères. Faut-il réduire le bloc commun (1 486) ou ajouter un sous-sélecteur `{{GAME_SPEC:section.key}}` ?
- Charte : le Grid & Match utilise 5 couleurs de rôle sur ses tuiles, ce qui contredit la règle des 4 couleurs maximum.

**Genres (étape 3)** : choix faits en v0 à confirmer
| Genre | Choix v0 à valider |
|---|---|
| 01 Runner | Vue de dessus, saut « visuel » (changement d'échelle), règle du chemin sûr, portes ×2 / ×3 temporaires |
| 02 Arena | `fit: expand`, monde 2400 × 2400, score = XP ramassé (et non le temps de survie), pas de montée de niveau |
| 03 Launch | Portrait, lance-pierre par glisser relatif n'importe où, 5 niveaux, score = cibles + tirs restants × 500 |
| 04 Platformer | Portrait avec montée verticale, `fit: expand`, 2 niveaux, checkpoints, boutons tactiles à l'écran |
| 05 Grid & Match | Match-3 avec cases couvertes (« glace »), 4 niveaux de 6×6 à 9×9, bonus selon les formes de match |
| 06 Tap & Choose | Partie de 240 s pour atteindre 100 K, cartes de choix, score = total gagné + bonus de temps |
| 07 Tower Defense | Grille de 9×12, 8 vagues, 2 tours (blaster et mortier), vente de tours, départ anticipé des vagues |
| 08 Bounce & Break | Sous-pas de 7 u au maximum, 3 niveaux, 3 bonus, la raquette suit la souris en option |
| 09 Narrative | Style Reigns, 4 stats, 20 événements, 10 fins, 4 prompts |
| 10 Music Tap | Horloge audio avec repli sur le temps de jeu, retour de 2 s en arrière à la reprise, morceau de 64 s, 4 couloirs |
