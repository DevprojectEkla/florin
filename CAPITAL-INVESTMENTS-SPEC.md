# Spec: Suivi des Investissements en Capital

## Objectif
Suivre les dépenses d'investissement en capital (mobilier, informatique, vêtements, sport, études) qui passent actuellement dans "Divers".

## Structure dans ODS
```
Ligne 3: Mobilier | Informatique | Vêtements | Étude | Sport
Ligne 2: Total investissements: 377,40 €
```

Transactions marquées avec:
- Catégorie: `I` (Investissement)
- Sous-catégorie: `MOB` (Mobilier), `INFO` (Informatique), `VET` (Vêtements), `SPORT`, `ETU` (Études)

## Solution Proposée

### 1. Nouvelles catégories
Créer un type de catégorie "capital" avec:
- `capital.furniture` - Mobilier
- `capital.tech` - Informatique & électronique
- `capital.clothing` - Vêtements
- `capital.education` - Études & formation
- `capital.sports` - Sport & équipements

### 2. Nouvelle carte Dashboard
Composant `CapitalInvestmentsCard` similaire à `InvestmentsSummaryCard` mais pour les dépenses en capital:
- Affiche le total investi par catégorie
- Drilldown vers les transactions
- Respect du filtre mois/année
- Mode "all years" pour voir le total sur toute la période

### 3. Placement
Après la carte `InvestmentsSummaryCard` dans le Dashboard

## Implementation
1. Ajouter le type "capital" aux catégories
2. Créer les 5 catégories capital.*
3. Créer le composant CapitalInvestmentsCard
4. L'intégrer au Dashboard
5. Ajouter les traductions
