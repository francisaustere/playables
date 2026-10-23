# Bêta-test des prompts avec Claude Code

Objectif : vérifier qu'une séquence de prompts **suffit à elle seule** à produire le bon jeu, avant de la donner à
Playables Builder. Claude Code joue le rôle de PB. Ce qu'il doit deviner révèle les trous du doc.

## Règles du test (pour que le test reste honnête)

1. **Session vierge** à chaque test : un nouveau dossier vide, **hors** de ce repo (sinon Claude lirait les specs).
   Par exemple `~/Documents/Claude/playables-beta/01-endless-runner-run1/`.
2. La session ne reçoit que :
   - `beta/session-brief.md`, une seule fois au début (le rôle et la règle des suppositions, sans aucune info de game
     design) ;
   - puis les fichiers `dist/planA/…/pN.txt` (ou `planB`), **collés un par un**, dans l'ordre, comme dans PB.
3. Plan A : on teste d'abord le Template 0 (`dist/planA/00-template-zero/p1..p3`), puis on **copie** le dossier du
   Template 0 dans le dossier de test du genre avant de coller les prompts du genre. Plan B : on part d'un dossier vide.
4. On ne répond à aucune question de la session et on ne corrige rien à la main : si quelque chose manque, c'est le doc
   qu'il faut corriger.
5. Après chaque prompt, on joue et on note ce qui va et ce qui ne va pas.

## Ce que la session doit produire

- Le jeu : `index.html` + `game_spec.json` + modules, qui tourne en ouvrant un serveur local
  (`npx serve` ou `python3 -m http.server`).
- `ASSUMPTIONS.md`, complété à chaque prompt : toutes les fois où le prompt était ambigu, incomplet ou contradictoire,
  avec le choix fait. Classement : **bloquant** (le résultat peut être faux), **mineur** (un détail).

## Grille de notation (à copier dans `beta/results/NN-runX.md`)

| Critère | Résultat |
|---|---|
| Mécaniques SOW présentes (spec §2) | x / n |
| Critères d'acceptation du genre (spec §15) | x / n |
| Checklist commune (`common/10-qa-checklist.md`) | x / n (sans le test sur appareil Android) |
| Suppositions bloquantes / mineures | n / n |
| Erreurs console | oui / non |
| Valeurs codées en dur hors game_spec | n |
| Taille de chaque prompt (rapport de build) | ok / ko |

**Prompt « vert »** : toutes les mécaniques SOW présentes, 0 supposition bloquante, 0 erreur console.

## Boucle de correction

1. Chaque supposition bloquante devient une modification de `genres/NN/spec.md`, puis du prompt concerné.
2. `npm run build`, en restant sous la limite de caractères (on comprime ailleurs s'il faut).
3. Nouvelle session vierge (`runX+1`). Pas plus de 3 runs par genre sans en reparler.

## Limite du test

Claude Code n'est pas Gemini et code probablement mieux que PB : un prompt vert ici est **nécessaire mais pas
suffisant**. En revanche, ce qui échoue dans Claude Code échouera presque sûrement dans PB.
