/**
 * Synthetic demo data for development builds.
 *
 * Everything here is invented: merchants, amounts and the account are fake.
 * Deterministic for a given seed, so screenshots, demos and (future) model
 * experiments are reproducible. It deliberately contains seasonality, a price
 * increase, a one-off large expense and a refund-like credit, because those
 * are the patterns trend/anomaly features need to be exercised against.
 */

export interface SeedTx {
  date: string; // YYYY-MM-DD
  label: string;
  debit: number | null;
  credit: number | null;
  category_slug: string | null;
}

export interface SeedStructure {
  fiscal_years: {
    label: string;
    start_year: number;
    start_month: number;
    opening_balance: number;
  }[];
  transactions: Record<string, SeedTx[]>;
}

/** Fake account number used by the dev seed. */
export const DEMO_ACCOUNT_NUMBER = '00012345678';

// Small deterministic PRNG (mulberry32)
function makeRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T,>(items: readonly T[]) => items[Math.floor(next() * items.length)],
    /** Skewed towards small amounts, like real card spending. */
    amount: (min: number, max: number) => {
      const x = next() ** 1.8;
      return Math.round((min + x * (max - min)) * 100) / 100;
    },
  };
}

const pad = (n: number) => String(n).padStart(2, '0');
const daysIn = (y: number, m: number) => new Date(y, m, 0).getDate();

const GROCERY_STORES = ['CARREFOUR MARKET', 'MONOPRIX', 'LIDL', 'PICARD', 'BOULANGERIE DU COIN', 'CASINO SHOP'];
const RESTAURANTS = ['LE PETIT BISTROT', 'PIZZERIA ROMA', 'SUSHI KYOTO', 'BURGER FACTORY', 'CAFE DES ARTS'];
const LEISURE = ['CINEMA PATHE', 'FNAC', 'STEAM GAMES', 'LIBRAIRIE DU PARC'];
const CLOTHES = ['DECATHLON', 'ZARA', 'UNIQLO', 'KIABI'];

/** Generate two fiscal years (Sept 2024 - Aug 2026) of fictional transactions. */
export function generateSyntheticSeed(seed = 42): SeedStructure {
  const rng = makeRng(seed);
  const transactions: Record<string, SeedTx[]> = {};
  const fiscalYears: SeedStructure['fiscal_years'] = [];
  let balance = 2400;

  for (const startYear of [2024, 2025]) {
    const label = `${startYear}-${startYear + 1}`;
    fiscalYears.push({ label, start_year: startYear, start_month: 9, opening_balance: Math.round(balance * 100) / 100 });
    const txs: SeedTx[] = [];

    for (let i = 0; i < 12; i++) {
      const month = ((8 + i) % 12) + 1;
      const year = month >= 9 ? startYear : startYear + 1;
      const ym = year * 100 + month;
      const winter = month === 12 || month <= 2;

      const add = (
        day: number,
        text: string,
        amount: number,
        kind: 'debit' | 'credit',
        slug: string | null
      ) => {
        const d = Math.min(day, daysIn(year, month));
        txs.push({
          date: `${year}-${pad(month)}-${pad(d)}`,
          label: text,
          debit: kind === 'debit' ? amount : null,
          credit: kind === 'credit' ? amount : null,
          category_slug: slug,
        });
      };
      const card = (day: number, merchant: string, amount: number, slug: string) =>
        add(day, `PAIEMENT PAR CARTE X1234 ${merchant} ${pad(Math.min(day, daysIn(year, month)))}/${pad(month)}`, amount, 'debit', slug);

      // Income
      add(27, 'VIREMENT EN VOTRE FAVEUR ACME SARL SALAIRE', ym >= 202509 ? 2230 : 2150, 'credit', 'income.salary');
      add(5, 'VIREMENT EN VOTRE FAVEUR CAF DE PARIS', 142, 'credit', 'income.benefit');

      // Fixed costs
      add(5, 'PRELEVEMENT AGENCE DU PARC LOYER', 820, 'debit', 'fixed.housing');
      add(12, 'PRELEVEMENT ELECTRICITE DE FRANCE', Math.round((46 + rng.int(0, 14) + (winter ? 26 : 0)) * 100) / 100, 'debit', 'fixed.energy');
      add(10, 'PRELEVEMENT MAIF ASSURANCE HABITATION', 18.4, 'debit', 'fixed.insurance');
      add(15, 'PRELEVEMENT FREE MOBILE', 19.99, 'debit', 'fixed.subscriptions');
      card(3, 'NETFLIX.COM', ym >= 202601 ? 15.49 : 13.49, 'fixed.subscriptions'); // price increase in Jan 2026
      card(20, 'SPOTIFY', 10.99, 'fixed.subscriptions');

      // Transport
      card(1, 'IDF MOBILITES NAVIGO', 88.8, 'variable.transport');

      // Groceries: a few small shops a week
      for (let k = 0, n = rng.int(6, 9); k < n; k++) {
        card(rng.int(1, 28), rng.pick(GROCERY_STORES), rng.amount(6, 85), 'variable.groceries');
      }
      // Restaurants
      for (let k = 0, n = rng.int(2, 6); k < n; k++) {
        card(rng.int(1, 28), rng.pick(RESTAURANTS), rng.amount(9, 48), 'variable.restaurant');
      }
      // Leisure
      for (let k = 0, n = rng.int(1, 3); k < n; k++) {
        card(rng.int(1, 28), rng.pick(LEISURE), rng.amount(5, 40), 'variable.leisure');
      }
      // Health (about one month in three)
      if (rng.next() < 0.35) card(rng.int(1, 28), 'PHARMACIE DE LA GARE', rng.amount(6, 35), 'variable.health');
      // Clothing: more in the sales (Jan, Jul)
      if (rng.next() < (month === 1 || month === 7 ? 0.9 : 0.3)) {
        card(rng.int(1, 28), rng.pick(CLOTHES), rng.amount(20, 90), 'variable.clothing');
      }

      // Seasonality
      if (month === 12) {
        card(rng.int(8, 22), 'FNAC', rng.amount(40, 120), 'variable.gifts');
        card(rng.int(8, 22), 'AMAZON EU SARL', rng.amount(30, 110), 'variable.gifts');
      }
      if (month === 8) {
        card(rng.int(1, 10), 'SNCF VOYAGES', rng.amount(120, 260), 'variable.transport');
        card(rng.int(1, 10), 'AIRBNB', rng.amount(160, 340), 'variable.leisure');
      }

      // Savings
      add(6, 'VIREMENT EMIS LEP', 500, 'debit', 'savings.lep');
      if (month % 3 === 0) add(7, 'VIREMENT EMIS TRADE REPUBLIC', 300, 'debit', 'savings.cto');
      if (month === 4) add(9, 'REPRISE DE TRESORERIE LEP', 300, 'credit', 'transfer.internal');

      // One-offs (useful to test anomaly detection)
      if (ym === 202503) card(14, 'GARAGE MARTIN REPARATION', 420, 'variable.transport');
      if (ym === 202602) card(11, 'MEUBLES LAMBERT', 389, 'variable.misc');
      if (ym === 202508) add(22, 'VIREMENT EN VOTRE FAVEUR DGFIP REMBOURSEMENT', 214, 'credit', 'income.other');
    }

    txs.sort((a, b) => (a.date === b.date ? a.label.localeCompare(b.label) : a.date < b.date ? -1 : 1));
    transactions[label] = txs;
    for (const t of txs) balance += (t.credit ?? 0) - (t.debit ?? 0);
  }

  return { fiscal_years: fiscalYears, transactions };
}
