// Pre-seeded categories — labels are i18n keys, resolved at render time.
// slug is the stable identifier used in code; label is the default French display value.

export interface CategorySeed {
  slug: string;
  label_fr: string;
  label_en: string;
  type: string;
  color: string;
  icon: string;
  is_system: number;
  sort_order: number;
}

export const CATEGORY_SEEDS: CategorySeed[] = [
  // Income
  { slug: 'income.salary',    label_fr: 'Salaire',                    label_en: 'Salary',               type: 'income',   color: '#22c55e', icon: '💼', is_system: 1, sort_order: 10 },
  { slug: 'income.benefit',   label_fr: 'Aides & allocations',        label_en: 'Benefits',             type: 'income',   color: '#86efac', icon: '🏛️', is_system: 1, sort_order: 11 },
  { slug: 'income.freelance', label_fr: 'Revenus complémentaires',    label_en: 'Side income',          type: 'income',   color: '#4ade80', icon: '📦', is_system: 0, sort_order: 12 },
  { slug: 'income.other',     label_fr: 'Autres revenus',             label_en: 'Other income',         type: 'income',   color: '#bbf7d0', icon: '➕', is_system: 0, sort_order: 13 },
  // Fixed expenses
  { slug: 'fixed.housing',       label_fr: 'Loyer & charges',              label_en: 'Rent & charges',         type: 'fixed',    color: '#f97316', icon: '🏠', is_system: 1, sort_order: 20 },
  { slug: 'fixed.energy',        label_fr: 'Énergie',                      label_en: 'Energy',                 type: 'fixed',    color: '#fb923c', icon: '⚡', is_system: 1, sort_order: 21 },
  { slug: 'fixed.insurance',     label_fr: 'Assurances',                   label_en: 'Insurance',              type: 'fixed',    color: '#fdba74', icon: '🛡️', is_system: 1, sort_order: 22 },
  { slug: 'fixed.subscriptions', label_fr: 'Abonnements',                  label_en: 'Subscriptions',          type: 'fixed',    color: '#fed7aa', icon: '📱', is_system: 1, sort_order: 23 },
  { slug: 'fixed.religious',     label_fr: 'Dons & pratique religieuse',   label_en: 'Donations & religious',  type: 'fixed',    color: '#fef3c7', icon: '✡️', is_system: 0, sort_order: 24 },
  { slug: 'fixed.loan',          label_fr: 'Remboursements d\'emprunt',    label_en: 'Loan repayments',        type: 'fixed',    color: '#fde68a', icon: '🏦', is_system: 0, sort_order: 25 },
  // Variable expenses
  { slug: 'variable.groceries',   label_fr: 'Alimentation & courses',  label_en: 'Groceries',       type: 'variable', color: '#3b82f6', icon: '🛒', is_system: 1, sort_order: 30 },
  { slug: 'variable.restaurant',  label_fr: 'Restaurants & cafés',     label_en: 'Restaurants',     type: 'variable', color: '#60a5fa', icon: '🍽️', is_system: 1, sort_order: 31 },
  { slug: 'variable.health',      label_fr: 'Santé',                   label_en: 'Health',          type: 'variable', color: '#93c5fd', icon: '💊', is_system: 1, sort_order: 32 },
  { slug: 'variable.leisure',     label_fr: 'Loisirs & sorties',       label_en: 'Leisure',         type: 'variable', color: '#bfdbfe', icon: '🎭', is_system: 1, sort_order: 33 },
  { slug: 'variable.transport',   label_fr: 'Transport',               label_en: 'Transport',       type: 'variable', color: '#dbeafe', icon: '🚇', is_system: 1, sort_order: 34 },
  { slug: 'variable.clothing',    label_fr: 'Vêtements',               label_en: 'Clothing',        type: 'variable', color: '#a78bfa', icon: '👗', is_system: 0, sort_order: 35 },
  { slug: 'variable.sport',       label_fr: 'Sport',                   label_en: 'Sport',           type: 'variable', color: '#c4b5fd', icon: '🏃', is_system: 0, sort_order: 36 },
  { slug: 'variable.education',   label_fr: 'Formation & éducation',   label_en: 'Education',       type: 'variable', color: '#ddd6fe', icon: '📚', is_system: 0, sort_order: 37 },
  { slug: 'variable.gifts',       label_fr: 'Cadeaux',                 label_en: 'Gifts',           type: 'variable', color: '#f0abfc', icon: '🎁', is_system: 0, sort_order: 38 },
  { slug: 'variable.misc',        label_fr: 'Divers',                  label_en: 'Miscellaneous',   type: 'variable', color: '#e0e7ff', icon: '🔖', is_system: 0, sort_order: 39 },
  // Savings
  { slug: 'savings.lep',     label_fr: 'Épargne LEP',  label_en: 'LEP Savings',   type: 'savings',  color: '#eab308', icon: '💰', is_system: 1, sort_order: 40 },
  { slug: 'savings.pea',     label_fr: 'PEA',          label_en: 'PEA',           type: 'savings',  color: '#facc15', icon: '📈', is_system: 1, sort_order: 41 },
  { slug: 'savings.cto',     label_fr: 'CTO',          label_en: 'CTO',           type: 'savings',  color: '#fde047', icon: '📊', is_system: 1, sort_order: 42 },
  { slug: 'savings.pea_pme', label_fr: 'PEA-PME',      label_en: 'PEA-PME',       type: 'savings',  color: '#fef08a', icon: '🏢', is_system: 1, sort_order: 43 },
  { slug: 'savings.other',   label_fr: 'Autre épargne', label_en: 'Other savings', type: 'savings',  color: '#fef9c3', icon: '🏧', is_system: 0, sort_order: 44 },
  // Transfers
  { slug: 'transfer.internal',       label_fr: 'Virement interne',  label_en: 'Internal transfer',  type: 'transfer', color: '#94a3b8', icon: '↔️', is_system: 1, sort_order: 50 },
  { slug: 'transfer.out_of_budget',  label_fr: 'Hors budget',       label_en: 'Out of budget',       type: 'transfer', color: '#cbd5e1', icon: '⚠️', is_system: 1, sort_order: 51 },
];

// Default classification rules seeded from observed CA bank data patterns
export const RULE_SEEDS: { pattern: string; slug: string; priority: number }[] = [
  { pattern: 'NOVAGENCE',              slug: 'fixed.housing',       priority: 100 },
  { pattern: 'CONTRAT GAZ',            slug: 'fixed.housing',       priority: 100 },
  { pattern: 'ELECTRICITE DE FRANCE',  slug: 'fixed.energy',        priority: 100 },
  { pattern: 'EDF',                    slug: 'fixed.energy',        priority:  90 },
  { pattern: 'AXA',                    slug: 'fixed.insurance',     priority: 100 },
  { pattern: 'MAIF',                   slug: 'fixed.insurance',     priority: 100 },
  { pattern: 'NETFLIX',                slug: 'fixed.subscriptions', priority: 100 },
  { pattern: 'LINODE',                 slug: 'fixed.subscriptions', priority: 100 },
  { pattern: 'FREE MOBILE',            slug: 'fixed.subscriptions', priority: 100 },
  { pattern: 'ORANGE',                 slug: 'fixed.subscriptions', priority: 100 },
  { pattern: 'SPOTIFY',                slug: 'fixed.subscriptions', priority: 100 },
  { pattern: 'DIOCESE',                slug: 'fixed.religious',     priority: 100 },
  { pattern: 'DENIER DU CULTE',        slug: 'fixed.religious',     priority: 100 },
  { pattern: 'ST VINCENT',             slug: 'fixed.religious',     priority: 100 },
  { pattern: 'WEEZEVENT',              slug: 'income.salary',       priority: 100 },
  { pattern: 'CAF DE',                 slug: 'income.benefit',      priority: 100 },
  { pattern: 'VIREMENT EN VOTRE FAVEUR\nCAF', slug: 'income.benefit', priority: 110 },
  { pattern: 'PAKAMA',                 slug: 'variable.groceries',  priority: 100 },
  { pattern: 'CASINO',                 slug: 'variable.groceries',  priority:  80 },
  { pattern: 'PICARD',                 slug: 'variable.groceries',  priority: 100 },
  { pattern: 'CLICHOISE',              slug: 'variable.groceries',  priority: 100 },
  { pattern: 'PRIMEURS',               slug: 'variable.groceries',  priority: 100 },
  { pattern: 'BOUCHERIE',              slug: 'variable.groceries',  priority: 100 },
  { pattern: 'BOULANGERIE',            slug: 'variable.groceries',  priority: 100 },
  { pattern: 'HAPPY BOBUN',            slug: 'variable.restaurant', priority: 100 },
  { pattern: 'LUCKY SUSHI',            slug: 'variable.restaurant', priority: 100 },
  { pattern: 'IDEMES',                 slug: 'variable.restaurant', priority: 100 },
  { pattern: 'BABY BURGER',            slug: 'variable.restaurant', priority: 100 },
  { pattern: 'DELICE THAI',            slug: 'variable.restaurant', priority: 100 },
  { pattern: 'CHOPPE',                 slug: 'variable.restaurant', priority: 100 },
  { pattern: 'FRANCK PROVOST',         slug: 'variable.health',     priority: 100 },
  { pattern: 'COIFFEUR',               slug: 'variable.health',     priority:  90 },
  { pattern: 'INTER PAKAMA',           slug: 'variable.groceries',  priority: 100 },
  { pattern: 'PAKAMA',                 slug: 'variable.groceries',  priority: 100 },
  { pattern: 'XIANGYU',                slug: 'variable.restaurant', priority: 100 },
  { pattern: 'BUHARA',                 slug: 'variable.restaurant', priority: 100 },
  { pattern: 'POKE & BOBUN',           slug: 'variable.restaurant', priority: 100 },
  { pattern: 'FOULO TRAITEUR',         slug: 'variable.restaurant', priority: 100 },
  { pattern: 'PASSION BASTILLE',       slug: 'variable.leisure',    priority: 100 },
  { pattern: 'BINOCLE EYEWEAR',        slug: 'variable.health',     priority: 100 },
  { pattern: 'GOOGLE*PLAY',            slug: 'fixed.subscriptions', priority:  90 },
  { pattern: 'KIRO PRO',               slug: 'fixed.subscriptions', priority: 100 },
  { pattern: 'REPRISE DE TRESORERIE',  slug: 'transfer.internal',   priority: 110 },
  { pattern: 'TRESORERIE',             slug: 'transfer.internal',   priority:  80 },
  { pattern: 'ANNUL. OPE.',            slug: 'transfer.internal',   priority: 110 },
  { pattern: 'Frais virement SEPA',    slug: 'fixed.subscriptions', priority:  90 },
  { pattern: 'Frais carte étranger',   slug: 'fixed.subscriptions', priority:  90 },
  { pattern: 'BHV',                    slug: 'variable.gifts',      priority: 100 },
  { pattern: "ST LOUIS D'ANTIN",       slug: 'fixed.religious',     priority: 110 },
  { pattern: 'ST LOUIS',               slug: 'fixed.religious',     priority: 100 },
  { pattern: 'ADM PAIEMENTS',          slug: 'fixed.religious',     priority: 100 },
  { pattern: 'TRADE REPUBLIC',         slug: 'savings.cto',         priority: 110 },
  { pattern: 'TRADE R',                slug: 'savings.cto',         priority: 100 },
  { pattern: '83486364',               slug: 'savings.pea',         priority: 120 },
  { pattern: '84034390',               slug: 'savings.pea_pme',     priority: 120 },
  { pattern: 'PEA PME',                slug: 'savings.pea_pme',     priority: 115 },
  { pattern: 'PEA/PME',                slug: 'savings.pea_pme',     priority: 115 },
  { pattern: 'versement PEA',          slug: 'savings.pea',         priority: 110 },
  { pattern: 'Bourse direct',          slug: 'savings.pea',         priority:  80 },
  { pattern: 'Bourse Direct',          slug: 'savings.pea',         priority:  80 },
];
