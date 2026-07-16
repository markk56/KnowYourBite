/**
 * Deterministic allergen *floor* — the 7 major allergens (ADR-000 §6, ARCHITECTURE
 * §5.3). A keyword matcher that runs ONLY on the canonical English food name
 * (`recipe_ingredients.canonical_name_en`), never on a locale translation, so the
 * clinical result is identical regardless of the dietitian's UI language.
 *
 * This is the *floor*: the AI layer may ADD suggestions (audited, additive-only),
 * and a dietitian confirms the final list — but this deterministic set is always
 * present and can never be silently removed by anything downstream. Because the
 * catalogue is conservative (word-boundary keyword hits), it favours flagging a
 * possible allergen over missing one; a dietitian removes false positives.
 */

export type Allergen = 'milk' | 'gluten' | 'eggs' | 'peanuts' | 'soy' | 'tree_nuts' | 'shellfish'

export const ALLERGENS: readonly Allergen[] = [
  'milk',
  'gluten',
  'eggs',
  'peanuts',
  'soy',
  'tree_nuts',
  'shellfish',
]

/**
 * Per-allergen English keyword lists. Matched case-insensitively on
 * word-ish boundaries so "cream" hits but "creamy-of-nothing" style substrings
 * inside longer unrelated words don't. Deliberately broad on the major-allergen
 * side (favour a false positive a dietitian can clear over a missed allergen).
 */
const KEYWORDS: Record<Allergen, string[]> = {
  milk: [
    'milk',
    'cheese',
    'butter',
    'cream',
    'yogurt',
    'yoghurt',
    'whey',
    'casein',
    'ghee',
    'curd',
    'custard',
    'kefir',
    'lactose',
    'parmesan',
    'mozzarella',
    'ricotta',
  ],
  gluten: [
    'wheat',
    'gluten',
    'barley',
    'rye',
    'malt',
    'bread',
    'pasta',
    'flour',
    'couscous',
    'bulgur',
    'semolina',
    'spelt',
    'farro',
    'seitan',
    'cracker',
    'breadcrumb',
    'breadcrumbs',
  ],
  eggs: ['egg', 'eggs', 'albumen', 'albumin', 'mayonnaise', 'meringue', 'ovalbumin'],
  peanuts: ['peanut', 'peanuts', 'groundnut', 'groundnuts', 'arachis'],
  soy: ['soy', 'soya', 'soybean', 'soybeans', 'edamame', 'tofu', 'tempeh', 'miso', 'tamari'],
  tree_nuts: [
    'almond',
    'almonds',
    'walnut',
    'walnuts',
    'cashew',
    'cashews',
    'pecan',
    'pecans',
    'pistachio',
    'pistachios',
    'hazelnut',
    'hazelnuts',
    'macadamia',
    'brazil nut',
    'pine nut',
    'chestnut',
    'praline',
    'marzipan',
    'nutella',
  ],
  shellfish: [
    'shrimp',
    'prawn',
    'prawns',
    'crab',
    'lobster',
    'crayfish',
    'crawfish',
    'scallop',
    'scallops',
    'clam',
    'clams',
    'mussel',
    'mussels',
    'oyster',
    'oysters',
    'squid',
    'calamari',
    'octopus',
    'crustacean',
    'shellfish',
  ],
}

/** Escape a keyword for safe use inside a RegExp. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Pre-compiled per-allergen matchers. `\b…\b` word boundaries keep "cod" from
 * matching inside "cocoa"; multi-word keywords (e.g. "pine nut") match across a
 * single space.
 */
const MATCHERS: Array<{ allergen: Allergen; re: RegExp }> = ALLERGENS.map((allergen) => ({
  allergen,
  re: new RegExp(`\\b(?:${KEYWORDS[allergen].map(escapeRegExp).join('|')})\\b`, 'i'),
}))

/** The deterministic allergen set implied by a single canonical English food name. */
export function detectAllergensForName(canonicalNameEn: string): Allergen[] {
  const text = canonicalNameEn.toLowerCase()
  const found: Allergen[] = []
  for (const { allergen, re } of MATCHERS) {
    if (re.test(text)) found.push(allergen)
  }
  return found
}

/**
 * The deterministic allergen floor for a whole recipe: the union of every
 * ingredient's canonical-English matches, returned in canonical `ALLERGENS`
 * order (stable output regardless of ingredient ordering).
 */
export function detectAllergenFloor(canonicalNamesEn: readonly string[]): Allergen[] {
  const set = new Set<Allergen>()
  for (const name of canonicalNamesEn) {
    for (const allergen of detectAllergensForName(name)) set.add(allergen)
  }
  return ALLERGENS.filter((a) => set.has(a))
}
