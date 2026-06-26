-- Manual classification of remaining 27 transactions based on label patterns
BEGIN TRANSACTION;

-- Tenue de compte = bank fees -> fixed.subscriptions
UPDATE transactions 
SET category_id = (SELECT id FROM categories WHERE slug = 'fixed.subscriptions')
WHERE date = '2025-12-16' AND debit = 24.0 AND category_id IS NULL;

-- Fin de mois = internal transfer
UPDATE transactions 
SET category_id = (SELECT id FROM categories WHERE slug = 'transfer.internal')
WHERE label LIKE '%Fin de mois%' AND category_id IS NULL;

-- SSD / Computer parts = variable.misc
UPDATE transactions 
SET category_id = (SELECT id FROM categories WHERE slug = 'variable.misc')
WHERE (label LIKE '%SSD%' OR label LIKE '%Config PC%') AND category_id IS NULL;

-- Cotisation carte = bank fees -> fixed.subscriptions
UPDATE transactions 
SET category_id = (SELECT id FROM categories WHERE slug = 'fixed.subscriptions')
WHERE label LIKE '%Cotisation carte%' AND category_id IS NULL;

-- TRADE REPUBLIC BAN = investments -> transfer.internal (or specific categories)
UPDATE transactions 
SET category_id = (SELECT id FROM categories WHERE slug = 'savings.cto')
WHERE label LIKE '%TRADE REPUBLIC BAN%' AND label LIKE '%investment%' AND category_id IS NULL;

UPDATE transactions 
SET category_id = (SELECT id FROM categories WHERE slug = 'variable.restaurant')
WHERE label LIKE '%TRADE REPUBLIC BAN%' AND label LIKE '%Restaurant%' AND category_id IS NULL;

UPDATE transactions 
SET category_id = (SELECT id FROM categories WHERE slug = 'variable.restaurant')
WHERE label LIKE '%TRADE REPUBLIC BAN%' AND label LIKE '%UberEATS%' AND category_id IS NULL;

UPDATE transactions 
SET category_id = (SELECT id FROM categories WHERE slug = 'variable.misc')
WHERE label LIKE '%TRADE REPUBLIC BAN%' AND label LIKE '%Amazon%' AND category_id IS NULL;

UPDATE transactions 
SET category_id = (SELECT id FROM categories WHERE slug = 'transfer.internal')
WHERE label LIKE '%TRADE REPUBLIC BAN%' AND category_id IS NULL;

-- CLEM et GWEN = groceries
UPDATE transactions 
SET category_id = (SELECT id FROM categories WHERE slug = 'variable.groceries')
WHERE label LIKE '%CLEM et GWEN%' AND category_id IS NULL;

-- Free Telecom = subscriptions
UPDATE transactions 
SET category_id = (SELECT id FROM categories WHERE slug = 'fixed.subscriptions')
WHERE label LIKE '%Free Telecom%' AND category_id IS NULL;

-- Retrait au distributeur = misc
UPDATE transactions 
SET category_id = (SELECT id FROM categories WHERE slug = 'variable.misc')
WHERE label LIKE '%RETRAIT AU DISTRIBUTEUR%' AND category_id IS NULL;

-- ROYAL BOURSE = restaurant
UPDATE transactions 
SET category_id = (SELECT id FROM categories WHERE slug = 'variable.restaurant')
WHERE label LIKE '%ROYAL BOURSE%' AND category_id IS NULL;

-- SCARAMOUCHE = restaurant
UPDATE transactions 
SET category_id = (SELECT id FROM categories WHERE slug = 'variable.restaurant')
WHERE label LIKE '%SCARAMOUCHE%' AND category_id IS NULL;

-- AU PETIT POUCET = restaurant
UPDATE transactions 
SET category_id = (SELECT id FROM categories WHERE slug = 'variable.restaurant')
WHERE label LIKE '%AU PETIT POUCET%' AND category_id IS NULL;

-- LIBRAIRIE = education/books
UPDATE transactions 
SET category_id = (SELECT id FROM categories WHERE slug = 'variable.education')
WHERE label LIKE '%LIBRAIRIE%' AND category_id IS NULL;

-- RESTAURANT F = restaurant (Chinese restaurant)
UPDATE transactions 
SET category_id = (SELECT id FROM categories WHERE slug = 'variable.restaurant')
WHERE label LIKE '%RESTAURANT F%' AND category_id IS NULL;

-- IDFM = transport
UPDATE transactions 
SET category_id = (SELECT id FROM categories WHERE slug = 'variable.transport')
WHERE label LIKE '%IDFM%' AND category_id IS NULL;

-- OPTICIEN = health or clothing -> let's say health
UPDATE transactions 
SET category_id = (SELECT id FROM categories WHERE slug = 'variable.health')
WHERE label LIKE '%BINOCLE%' AND category_id IS NULL;

-- Speed dating = leisure
UPDATE transactions 
SET category_id = (SELECT id FROM categories WHERE slug = 'variable.leisure')
WHERE label LIKE '%Speed dating%' AND category_id IS NULL;

-- LOISIRS = leisure/nightlife
UPDATE transactions 
SET category_id = (SELECT id FROM categories WHERE slug = 'variable.leisure')
WHERE label LIKE '%LOISIRS%' AND category_id IS NULL;

-- RESTAURANT H = restaurant
UPDATE transactions 
SET category_id = (SELECT id FROM categories WHERE slug = 'variable.restaurant')
WHERE label LIKE '%POKE%BOBUN%' AND category_id IS NULL;

-- Catch-all for PAIEMENT PAR CARTE in CLICHY without category = groceries
UPDATE transactions 
SET category_id = (SELECT id FROM categories WHERE slug = 'variable.groceries')
WHERE label LIKE '%PAIEMENT PAR CARTE%CLICHY%' 
  AND date = '2026-06-01' 
  AND debit = 4.9 
  AND category_id IS NULL;

COMMIT;

-- Check remaining unclassified
SELECT 'Remaining unclassified: ' || COUNT(*) 
FROM transactions 
WHERE fiscal_year_id = 2 AND category_id IS NULL;
