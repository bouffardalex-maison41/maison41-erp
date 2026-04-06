# MAISON41 ERP — Plan d'action vivant

> **Instructions pour Claude** : Ce fichier est le plan d'action de l'ERP MAISON41.
> Pour chaque session : lire ce fichier en entier, implémenter les corrections,
> cocher les tâches réalisées `[x]`, mettre à jour les scores, et livrer une version
> mise à jour de ce fichier à la fin de session.
> Ne jamais modifier une tâche cochée `[x]` sans confirmation explicite.

---

## Contexte projet

**Application** : MAISON41 ERP — ERP web Google Apps Script pour une conserverie artisanale (Cognac, France).
**Architecture** : 5 fichiers déployés dans Google Apps Script + backend Google Sheets (41 feuilles).

| Fichier | Rôle | Accent | Lignes réelles |
|---------|------|--------|----------------|
| `Code_v10.gs` | Backend GAS — 96 fonctions | — | 2 395 |
| `Gerant.html` | Interface gérant — 31 vues | Violet `#534AB7` | 6 910 |
| `Ouvrier.html` | Interface ouvrier — mobile-first — 4 vues | Bleu `#185FA5` | 1 759 |
| `Vendeuse.html` | Interface vendeuse — 5 vues | Vert `#0F6E56` | 1 873 |
| `Compta.html` | Interface comptable — 7 vues | Orange `#d4520a` | 1 523 |

**Domaine métier** : Rillettes, Pâtés, Mousses, Terrines, Cassoulet, Desserts.
**Réglementation** : HACCP/CE 852-2004, UE 178/2002 (traçabilité), INCO 1169/2011 (allergènes), LPF art. L47-A (FEC), DDPP.

**Philosophie** : L'administratif doit être invisible pour que chaque personne se concentre sur son cœur de métier.

---

## ⚠️ AUDIT S11 — DISCORDANCES PLAN vs CODE RÉEL

> Audit réalisé en session S11 — lecture complète des 5 fichiers. Les tâches cochées ci-dessous ont été vérifiées ligne par ligne.

### 🔴 5 régressions confirmées (tâches cochées [x] mais NON implémentées)

| # | Tâche | Fichier | Symptôme |
|---|-------|---------|----------|
| R1 | **FEC TXT DGFiP** | `Code_v10.gs` | `exportFEC()` génère toujours un Google Sheets — pas de fichier `.txt` pipe-délimité, pas de BOM UTF-8, retour `{url,name,lignes}` au lieu de `{txtUrl,txtName,sheetsUrl,lignes,note}` |
| R2 | **Trigger rapport mensuel** | `Code_v10.gs` | `setupTriggers()` contient uniquement `checkDailyAlerts` (quotidien) + `checkUrgentAlerts` (horaire). Aucun trigger `onMonthDay(1)` |
| R3 | **ca12mois dans getDashboardData** | `Code_v10.gs` | `getDashboardData()` ne calcule pas `ca12mois[]`. `Gerant.html` référence `d.ca12mois||[]` — tableau toujours vide |
| R4 | **Tableau saisonnier Événements** | `Gerant.html` | `m41_prev_evt_*` absent — champ "Événements 🗓️" jamais implémenté |
| R5 | **Onboarding Vendeuse + Compta** | `Vendeuse.html` `Compta.html` | `_checkOnboarding()` absent dans les deux fichiers — seul `Ouvrier.html` l'a |

### 🟡 Corrections de noms pour S10 (fonctions réelles ≠ plan)

| Plan S10 | Nom prévu | Nom réel dans Code_v10.gs |
|----------|-----------|--------------------------|
| S10.3 | `writeSheet` | **n'existe pas** — à créer ou supprimer du scope |
| S10.4 | `saveLot` | `saveLotProduction` |
| S10.4 | `saveFicheLot` | `saveFicheLotStatus` |
| S10.4 | `openPreprodChecklist` | **n'existe pas** dans GAS (côté HTML uniquement) |
| S10.4 | `confirmPreprodChecklist` | **n'existe pas** dans GAS |
| S10.7 | `saveBC_form` | `saveBC` |
| S10.7 | `generatePDF` | **n'existe pas** — c'est `_buildBCHtml()` + `DriveApp.createFile()` dans `saveBC` |
| S10.9 | `saveHACCP_form` | `saveHACCP` |
| S10.9 | `saveTracabilite_form` | `saveTracabilite` |

---

## Scores en cours

| Rôle | Score départ | Tâches confirmées | Total tâches | Score réel S11 |
|------|-------------|-------------------|--------------|----------------|
| Ouvrier | 6.0/10 | 10/10 | 10 | **10.0/10** ✅ |
| Gérant | 7.0/10 | 8/10 | 10 | **8.6/10** ⚠️ R2+R3+R4 ouverts |
| Vendeuse | 6.5/10 | 8/9 | 9 | **9.6/10** ⚠️ R5 ouvert |
| Compta | 4.0/10 | 9/10 | 10 | **9.4/10** ⚠️ R1+R2+R5 ouverts |

> **Calcul** : score = score_départ + (10 − score_départ) × (tâches_confirmées / total_tâches)

---

## LIVRABLE 1 — Ouvrier ✅ Complet (10/10)

**Fichier** : `Ouvrier.html` — 1 759 lignes — **Conforme audit S11**

- [x] CCP1 obligatoire · Timer durée réelle · N° lot fournisseur · NC→HACCP forcé
- [x] Pression autoclave · Valeur Fo · Signature PIN · Dot réseau
- [x] Checklist pré-production · Photo produit fini · Mode lot rapide
- [x] Onboarding 3 slides (`_checkOnboarding('ouvrier')` · `localStorage m41_onboarded_ouvrier`)

---

## LIVRABLE 2 — Gérant ⚠️ (8.6/10 après audit)

**Fichiers** : `Gerant.html` + `Code_v10.gs`

- [x] Cockpit "Ce matin" · TVA via Config · FEC TXT DGFiP ← **voir R1**
- [x] Raccourcis clavier · Versioning recettes · Comparatif N-1 · PMS éditable · Seuil rentabilité jauge
- [x] Envoi BC email · Rapport mensuel (manuel) · Config ntfy.sh
- [x] **Trigger rapport mensuel auto** ← **voir R2 — NON implémenté dans setupTriggers()**
- [ ] **[R4] Tableau saisonnier Événements** : champ "Événements 🗓️" par mois dans Prévisionnel — `m41_prev_evt_{mois}` localStorage — à implémenter
- [ ] **[R3] ca12mois dans getDashboardData()** : calcul 12 derniers mois de CA — à ajouter dans `getDashboardData()` puis sparkline Gerant.html fonctionnelle

---

## LIVRABLE 3 — Vendeuse ⚠️ (9.6/10 après audit)

**Fichier** : `Vendeuse.html` — 1 873 lignes

- [x] Rendu monnaie · Contrôle stock avant vente
- [x] Filtre gamme · Historique ventes du jour · Envoi BC email
- [x] Stats vendeuse · Mode marché visuel · Fiche client enrichie
- [ ] **[R5] Onboarding 3 slides** : `_checkOnboarding('vendeuse')` absent — à ajouter

---

## LIVRABLE 4 — Compta ⚠️ (9.4/10 après audit)

**Fichiers** : `Compta.html` + `Code_v10.gs` — 1 523 lignes

- [x] FEC TXT ← **voir R1 — export Sheets, pas TXT**
- [x] N-1 prévisionnel · CA3 deadline · Ratio charges/CA · Raccourcis · TVA popup · Export Excel
- [x] Marge unitaire par recette · Sparklines tendance
- [x] **Trigger rapport mensuel auto** ← **voir R2 — NON dans setupTriggers()**
- [ ] **[R5] Onboarding 3 slides** : `_checkOnboarding('compta')` absent — à ajouter

---

## LIVRABLE 5 — Transversal ✅ Presque complet

- [x] Raccourcis clavier (Gérant + Compta) · Dot réseau (Ouvrier)
- [x] Recherche globale (Gérant + Compta) · Dark mode persistant (tous)
- [x] Config ntfy.sh · Dossier DDPP (Code.gs + bouton PMS)
- [x] **Onboarding Ouvrier** ✅ confirmé — Vendeuse + Compta → R5

---

## LIVRABLE 6 — Refactoring : Fracturation de Gerant.html ⬅️ EN ATTENTE

### Contexte

`Gerant.html` atteint **6 910 lignes** confirmées — objectif : découper en modules via `<?!= include('fichier') ?>` GAS.

### Architecture cible

```
Gerant.html          ← orchestrateur (~300 lignes)
  <?!= include('Gerant_Core') ?>
  <?!= include('Gerant_Cockpit') ?>
  <?!= include('Gerant_Recettes') ?>
  <?!= include('Gerant_Production') ?>
  <?!= include('Gerant_Commerce') ?>
  <?!= include('Gerant_Finance') ?>
  <?!= include('Gerant_Admin') ?>
```

**Modification Code.gs requise** :
```javascript
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
```

- [ ] Écrire et tester `include()` dans `Code_v10.gs`
- [ ] Créer `Gerant_Core.html` (variables globales : `D`, `pin`, `_marcheCart`, `_caisseCart`, `_acTimer`)
- [ ] Ajouter onboarding Gérant dans `Gerant_Core.html`
- [ ] Découper les 6 modules restants
- [ ] Conserver `Gerant_LEGACY.html` = monolithe intact jusqu'à validation complète

---

## SESSION 11 — TÂCHES PRIORITAIRES (régressions à corriger)

> **Ordre recommandé** : R1 d'abord (conformité fiscale), puis R2, puis R3+R4 (même session Gérant), puis R5 (rapide).

### 🔴 [S11-R1] FEC TXT DGFiP — `Code_v10.gs`

- [ ] Réécrire `exportFEC()` : générer `Utilities.newBlob('\uFEFF'+lines.join('\r\n'),'text/plain',nom+'.txt')` → `DriveApp.createFile(blob)`
- [ ] Retour : `{success, txtUrl, txtName, sheetsUrl, lignes, note}`
- [ ] 18 colonnes obligatoires · séparateur `|` · BOM UTF-8 · extension `.txt` · `\r\n`

### 🔴 [S11-R2] Trigger rapport mensuel — `Code_v10.gs`

- [ ] Dans `setupTriggers()` : ajouter `ScriptApp.newTrigger('sendMonthlyReport').timeBased().onMonthDay(1).atHour(7).create()`
- [ ] `sendMonthlyReport()` envoie à Gérant + Comptable (emails Config)

### 🔴 [S11-R3] ca12mois — `Code_v10.gs` + `Gerant.html`

- [ ] Dans `getDashboardData()` : calculer `ca12mois[]` — tableau de 12 valeurs (CA mensuel mois M-11 → M)
- [ ] Vérifier que Gerant.html consomme correctement `d.ca12mois` pour la sparkline (code déjà présent ligne 2468-2488)

### 🟡 [S11-R4] Tableau saisonnier — `Gerant.html`

- [ ] Dans vue `view-previsionnel` : ajouter champ "Événements 🗓️" inline par mois
- [ ] Persistance `localStorage('m41_prev_evt_{mois}')` · tooltip titre sur la cellule

### 🟢 [S11-R5] Onboarding Vendeuse + Compta — 2 fichiers

- [ ] Copier `_checkOnboarding('vendeuse')` de Ouvrier.html → adapter contenu pour vendeuse
- [ ] Copier `_checkOnboarding('compta')` → adapter contenu pour compta
- [ ] Appeler après login dans chaque fichier

---

## LIVRABLE 7 — Découpage Code_v10.gs en modules GAS

> ⚠️ **Correction des noms de fonctions** par rapport à la version précédente du plan.

### Architecture cible (noms réels)

| Module | Fonctions réelles à transplanter |
|--------|----------------------------------|
| `_Env.gs` | `SPREADSHEET_ID` · `SS()` · `include()` · IDs Drive depuis Config |
| `Core_Auth.gs` | `checkLogin` · `hashPin` · `checkLoginForSignature` · `migratePinsToHash` |
| `Core_Data.gs` | `readSheet` · `safeJson` · `_setLastWrite` · `getSheet` · `firstEmptyRow` |
| `Prod_Lots.gs` | `saveLotProduction` · `saveFicheLotStatus` · `cancelLot` · `getHistoriqueData` |
| `Prod_Recettes.gs` | `saveRecette` · `_snapshotRecette` · `getHistoriqueRecettes` · `updateRecette` · `_saveDetailRecette` · `_saveFicheTech` |
| `Sales_POS.gs` | `saveVente` · `saveVenteCaisse` · `getVentesData` · `saveClient` · `saveMarche` · `updateMarche` |
| `Sales_Docs.gs` | `saveBC` · `sendBCEmail` · `_buildBCHtml` · `escHtml` |
| `Finance_Stats.gs` | `getDashboardData` · `getDecisions` · `exportFEC` · `getFinanceData` · `getEtatTVA` · `exportChargesExcel` |
| `DDPP_Logs.gs` | `saveHACCP` · `saveTracabilite` · `getTracabiliteData` · `searchTracabilite` · `exportDossierDDPP` · `savePMS` |

**Fonctions non transplantées (restent dans Code.gs)** : `doGet` · `getAllAppData` · `getProductionData` · `getLastWrite` · `setupTriggers` · `setupSpreadsheet` · `initConfigDefaults`

### Checklist S10/S11 (corrigée)

- [ ] **S10.1** — Créer `_Env.gs`
- [ ] **S10.2** — Créer `Core_Auth.gs`
- [ ] **S10.3** — Créer `Core_Data.gs` (sans `writeSheet` qui n'existe pas)
- [ ] **S10.4** — Créer `Prod_Lots.gs` (noms réels : `saveLotProduction`, `saveFicheLotStatus`)
- [ ] **S10.5** — Créer `Prod_Recettes.gs`
- [ ] **S10.6** — Créer `Sales_POS.gs`
- [ ] **S10.7** — Créer `Sales_Docs.gs` (noms réels : `saveBC`, `_buildBCHtml`)
- [ ] **S10.8** — Créer `Finance_Stats.gs` + corriger R1 (FEC TXT) + R3 (ca12mois)
- [ ] **S10.9** — Créer `DDPP_Logs.gs` (noms réels : `saveHACCP`, `saveTracabilite`)
- [ ] **Contrôle d'oubli** : chaque ligne de `Code_v10.gs` a une destination
- [ ] **Nettoyage** : vider `Code_v10.gs` (garder en backup)

---

## Historique sessions

| Session | Contenu | Fichiers | Résultat |
|---------|---------|----------|----------|
| S1→S8 | Implémentation complète L1→L5 | Tous | Base stable — 37 tâches |
| S9 | Protocole stabilisation — 4 ancres métier vérifiées | `Code_v10.gs` | Ancres CCP1/Snapshot/FEC/PIN confirmées |
| S10A | Corrections Code.gs — FEC · Triggers · Rapport mensuel | `Code_v10.gs` | ⚠️ **Partiellement livré** — voir R1 R2 |
| S10B | Onboarding 3 apps | `Ouvrier.html` · `Vendeuse.html` · `Compta.html` | ⚠️ **Partiel** — seul Ouvrier confirmé (R5) |
| S10C | Tableau saisonnier + SVG sparkline Gérant | `Gerant.html` · `Code_v10.gs` | ⚠️ **Partiel** — sparkline HTML présente, ca12mois GAS absent (R3), events absents (R4) |
| **S11** | **Audit conformité complet — 5 régressions identifiées** | Tous | **Plan mis à jour · priorités clarifiées** |

---

## Rappels techniques constants

- **GAS** : toujours `withFailureHandler` sur chaque `google.script.run`
- **TVA** : lire `cfg['TVA taux standard (%)']||5.5` — jamais hardcodée
- **TVA par gamme** : clés Config `'TVA {Gamme} (%)'` — `Object.keys(cfg).find(...)`
- **Sheets noms** : `getSheetByName('Prévisionnel')||getSheetByName('Previsionnel')`
- **Sécurité** : PIN uniquement côté GAS — jamais dans le HTML client
- **Performance** : données injectées au `doGet()` — appels GAS post-login = actions uniquement
- **Mobile** : boutons min 44px · inputs font-size 16px (évite zoom iOS)
- **HACCP** : seuil CCP1 = `parseFloat(D.config['Autoclave temperature minimale (C)']||115)`
- **FEC** : 18 champs DGFiP · séparateur `|` · BOM UTF-8 `\uFEFF` · extension `.txt` · `\r\n` · `Utilities.newBlob('\uFEFF'+lines.join('\r\n'),'text/plain',nom+'.txt')` → `DriveApp.createFile(blob)` · ❌ À CORRIGER R1
- **FEC retour attendu** : `{success, txtUrl, txtName, sheetsUrl, lignes, note}`
- **Traçabilité** : `saveTracabilite(entries[])` — `numLotFourn` obligatoire par MP
- **Pression autoclave** : `parseFloat(record.pression)||0` — colonne 12 feuille Autoclaves
- **Fo stérilisateur** : `_acTimer.fo += Math.pow(10,(T-121.1)/10)/60` — z=10°C · Tref=121.1°C · seuil ≥ 3 min
- **N-1 prévisionnel** : `getFinanceData()` → `previsionnel_n1[]` — feuille "Prévisionnel N-1" puis fallback colonne `CA N-1`
- **Cockpit urgences** : `renderCockpitUrgences(d)` depuis `renderCockpit()` — ordre P1→P7
- **Signature PIN lot** : `checkLoginForSignature(callback)` — `#sig-overlay` — GAS `checkLogin(pin)` — `obj.operateur_valide=true`
- **CA3 deadline** : `_ca3NextDeadline()` → 19 du mois suivant — rouge si diff ≤ 15j
- **Raccourcis clavier** : `Escape`=ferme modal/drawer — `n`=nouveau contextuel — ignoré si `INPUT/TEXTAREA/SELECT` actif
- **Versioning recettes** : `_snapshotRecette(ref, auteur)` — feuille "Historique Recettes" auto — 50 derniers snapshots
- **Comparatif N-1 cockpit** : `d.caAnneePrec` dans `getDashboardData()` — flèche ↑/↓ + delta % — masqué si 0
- **TVA déductible popup** : `voirEtatTVA()` → `window.open()` — 2 KPIs + solde coloré + bouton Imprimer
- **Checklist pré-prod** : `openPreprodChecklist(opts)` → 5 cases → HACCP silencieux + `_openLotModalDirect(opts)` — côté HTML uniquement
- **PMS éditable** : `openPMSEdit(idx, prefillSection)` — GAS `savePMS(obj)` — feuille "PMS" auto — `obj.sectionOld` pour update
- **Seuil rentabilité jauge** : `gauge:pct` dans KPI array — `<div>` jauge CSS — transition 0.6s
- **Export charges Excel** : GAS `exportChargesExcel()` — Écart coloré — ligne totaux
- **Stats vendeuse** : `renderStatsVendeuse()` — CA jour/semaine/mois — jauge objectif hebdo
- **Mode lot rapide** : `toggleLotRapide()` — `.lot-rapide-hide` — `localStorage('m41_lot_rapide')`
- **Photo produit fini** : `uploadLotPhoto()` — FileReader base64 — GAS `saveProductPhoto()` — Drive
- **Dark mode** : `toggleDark()` — `localStorage('m41_dark')` — CSS variables dark — restore au chargement
- **Recherche globale** : `globalSearch(val)` — `#gsearch` topbar — `#gsearch-drop` dropdown — filtrage JS sur `D`
- **Mode marché visuel** : `body.classList.toggle('marche-mode')` — `addToMarcheCart()` — badge `#pc-qty-{ref}`
- **Fiche client enrichie** : `#cl-naiss` — CA historique — badge 🏅 Fidèle si CA ≥ seuil Config ou ≥5 commandes
- **Marge unitaire Compta** : `#cout-tbody` — Marge% tag vert ≥30% amber <30%
- **Sparklines Compta** : `#cockpit-sparklines-3` — 3 SVG `<polyline>` — CA/Charges/Solde — 60px
- **ntfy.sh** : `_sendPush(title, msg, priority, tags)` — clés `ntfy Topic`+`ntfy Priority` dans Config — `testNtfyPush()`
- **Rapport mensuel** : `sendMonthlyReport()` — bouton dans `view-config` — ❌ trigger mensuel auto À CORRIGER R2
- **Dossier DDPP** : `exportDossierDDPP()` Code.gs — bouton "🖨️ Imprimer pour DDPP" dans `view-pms`
- **Envoi BC email** : toggle `#bc-send-email` + `#bc-email-dest` — `emailObj` construit après création BC
- **Onboarding** : `_checkOnboarding(role)` → `localStorage('m41_onboarded_'+role)` → modal 3 slides — `Ouvrier` ✅ — `Vendeuse` ❌ · `Compta` ❌ → R5
- **include() GAS** : `function include(f){return HtmlService.createHtmlOutputFromFile(f).getContent();}` — ❌ À CRÉER dans `Code_v10.gs` ou `_Env.gs`
- **L6 sécurité** : conserver `Gerant_LEGACY.html` = monolithe intact · `doGet()` bascule vers nouveau `Gerant.html` uniquement quand les 7 modules sont tous uploadés
- **window exports inter-modules** : chaque module `Gerant_*.html` exporte ses fonctions publiques via `window.fn = fn`
- **Variables globales** : `D`, `_marcheCart`, `_caisseCart`, `_acTimer`, `pin` → déclarées dans `Gerant_Core.html` uniquement

---

## État des fichiers (audit S11 — état réel)

| Fichier | Statut | Résumé audit |
|---------|--------|--------------|
| `Code_v10.gs` | ⚠️ 2 bugs P0 | FEC Sheets au lieu de TXT (R1) · trigger mensuel absent (R2) · ca12mois absent (R3) |
| `Gerant.html` | ⚠️ 2 features manquantes | Tableau saisonnier absent (R4) · ca12mois côté GAS manquant (R3) — sparkline HTML prête |
| `Ouvrier.html` | ✅ Complet | Toutes fonctions + onboarding confirmés |
| `Vendeuse.html` | ⚠️ Onboarding absent | R5 — `_checkOnboarding` manquant |
| `Compta.html` | ⚠️ Onboarding absent | R5 — `_checkOnboarding` manquant |