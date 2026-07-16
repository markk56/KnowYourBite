import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces'
import type { Allergen, Locale, NutrientsDto } from '@kyb/shared'

/**
 * Pure pdfmake document builder for a recipe export (ADR §10). Declarative and
 * fully testable via its data structure — no I/O, no fonts here; rendering to a
 * PDF buffer lives in `render.ts`. The input is a FROZEN snapshot (built at export
 * time from the recipe's immutable ingredient snapshots), so a later recipe edit
 * never changes an already-delivered document.
 */

export interface ExportIngredientLine {
  canonicalNameEn: string
  amount: number
  unit: string
  gramsResolved: number
}

export interface RecipeExportSnapshot {
  title: string
  locale: Locale
  baseServings: number
  servingsRequested: number
  ingredients: ExportIngredientLine[]
  /** Nutrition scaled to `servingsRequested`. */
  total: NutrientsDto
  /** Per-serving nutrition (invariant to serving count). */
  perServing: NutrientsDto
  allergens: Allergen[]
  instructions: string | null
  notes: string | null
  storageRecommendation: string | null
  prepTimeMinutes: number | null
  cookTimeMinutes: number | null
  clinicName: string | null
  generatedAtIso: string
}

// Brand palette (Design Protocol): gold/amber primary, olive secondary, warm brown text.
const GOLD = '#D6A32A'
const OLIVE = '#89A46A'
const BROWN = '#4A3B2A'
const MUTED = '#7A6E5D'

type Labels = Record<
  | 'servings'
  | 'ingredients'
  | 'nutrition'
  | 'perServing'
  | 'total'
  | 'allergens'
  | 'preparation'
  | 'notes'
  | 'storage'
  | 'prepTime'
  | 'cookTime'
  | 'minutes'
  | 'kcal'
  | 'protein'
  | 'carbs'
  | 'fat'
  | 'fiber'
  | 'salt'
  | 'generatedBy'
  | 'noAllergens',
  string
>

const LABELS: Record<Locale, Labels> = {
  en: {
    servings: 'Servings',
    ingredients: 'Ingredients',
    nutrition: 'Nutrition',
    perServing: 'Per serving',
    total: 'Total',
    allergens: 'Allergens',
    preparation: 'Preparation',
    notes: 'Notes',
    storage: 'Storage',
    prepTime: 'Prep time',
    cookTime: 'Cook time',
    minutes: 'min',
    kcal: 'Energy (kcal)',
    protein: 'Protein (g)',
    carbs: 'Carbs (g)',
    fat: 'Fat (g)',
    fiber: 'Fibre (g)',
    salt: 'Salt (g)',
    generatedBy: 'Know Your Bite — Dietitian Platform',
    noAllergens: 'No major allergens detected',
  },
  hu: {
    servings: 'Adagok',
    ingredients: 'Hozzávalók',
    nutrition: 'Tápérték',
    perServing: 'Adagonként',
    total: 'Összesen',
    allergens: 'Allergének',
    preparation: 'Elkészítés',
    notes: 'Megjegyzések',
    storage: 'Tárolás',
    prepTime: 'Előkészítés',
    cookTime: 'Főzési idő',
    minutes: 'perc',
    kcal: 'Energia (kcal)',
    protein: 'Fehérje (g)',
    carbs: 'Szénhidrát (g)',
    fat: 'Zsír (g)',
    fiber: 'Rost (g)',
    salt: 'Só (g)',
    generatedBy: 'Know Your Bite — Dietetikus Platform',
    noAllergens: 'Nem található jelentős allergén',
  },
  ro: {
    servings: 'Porții',
    ingredients: 'Ingrediente',
    nutrition: 'Valori nutriționale',
    perServing: 'La porție',
    total: 'Total',
    allergens: 'Alergeni',
    preparation: 'Preparare',
    notes: 'Note',
    storage: 'Păstrare',
    prepTime: 'Timp de pregătire',
    cookTime: 'Timp de gătire',
    minutes: 'min',
    kcal: 'Energie (kcal)',
    protein: 'Proteine (g)',
    carbs: 'Glucide (g)',
    fat: 'Grăsimi (g)',
    fiber: 'Fibre (g)',
    salt: 'Sare (g)',
    generatedBy: 'Know Your Bite — Platformă pentru Dieteticieni',
    noAllergens: 'Niciun alergen major detectat',
  },
}

const ALLERGEN_LABELS: Record<Locale, Record<Allergen, string>> = {
  en: {
    milk: 'Milk',
    gluten: 'Gluten',
    eggs: 'Eggs',
    peanuts: 'Peanuts',
    soy: 'Soy',
    tree_nuts: 'Tree nuts',
    shellfish: 'Shellfish',
  },
  hu: {
    milk: 'Tej',
    gluten: 'Glutén',
    eggs: 'Tojás',
    peanuts: 'Földimogyoró',
    soy: 'Szója',
    tree_nuts: 'Diófélék',
    shellfish: 'Rákfélék',
  },
  ro: {
    milk: 'Lapte',
    gluten: 'Gluten',
    eggs: 'Ouă',
    peanuts: 'Arahide',
    soy: 'Soia',
    tree_nuts: 'Nuci',
    shellfish: 'Crustacee',
  },
}

/** Format a number with the locale's decimal separator (RO/HU use a comma). */
function fmt(value: number, locale: Locale, decimals = 1): string {
  const rounded = Math.round(value * 10 ** decimals) / 10 ** decimals
  const s = rounded.toFixed(decimals)
  return locale === 'en' ? s : s.replace('.', ',')
}

function nutritionRows(snapshot: RecipeExportSnapshot, l: Labels): string[][] {
  const { locale, perServing, total } = snapshot
  const row = (label: string, per: number, tot: number, decimals = 1): string[] => [
    label,
    fmt(per, locale, decimals),
    fmt(tot, locale, decimals),
  ]
  return [
    [l.nutrition, l.perServing, `${l.total} (${snapshot.servingsRequested})`],
    row(l.kcal, perServing.kcal, total.kcal, 0),
    row(l.protein, perServing.proteinG, total.proteinG),
    row(l.carbs, perServing.carbG, total.carbG),
    row(l.fat, perServing.fatG, total.fatG),
    row(l.fiber, perServing.fiberG, total.fiberG),
    row(l.salt, perServing.saltG, total.saltG, 2),
  ]
}

export function buildRecipeDocDefinition(snapshot: RecipeExportSnapshot): TDocumentDefinitions {
  const l = LABELS[snapshot.locale]
  const content: Content[] = []

  // Header
  content.push({ text: snapshot.title, style: 'title' })
  const meta: string[] = [`${l.servings}: ${snapshot.servingsRequested}`]
  if (snapshot.prepTimeMinutes != null) meta.push(`${l.prepTime}: ${snapshot.prepTimeMinutes} ${l.minutes}`)
  if (snapshot.cookTimeMinutes != null) meta.push(`${l.cookTime}: ${snapshot.cookTimeMinutes} ${l.minutes}`)
  content.push({ text: meta.join('   ·   '), style: 'meta', margin: [0, 2, 0, 12] })

  // Ingredients
  content.push({ text: l.ingredients, style: 'section' })
  content.push({
    ul: snapshot.ingredients.map(
      (ing) => `${fmt(ing.amount, snapshot.locale, 2)} ${ing.unit} — ${ing.canonicalNameEn} (${fmt(ing.gramsResolved, snapshot.locale, 0)} g)`,
    ),
    margin: [0, 0, 0, 12],
  })

  // Nutrition table
  content.push({ text: l.nutrition, style: 'section' })
  content.push({
    table: { headerRows: 1, widths: ['*', 'auto', 'auto'], body: nutritionRows(snapshot, l) },
    layout: 'lightHorizontalLines',
    margin: [0, 0, 0, 12],
  })

  // Allergens
  content.push({ text: l.allergens, style: 'section' })
  content.push({
    text:
      snapshot.allergens.length > 0
        ? snapshot.allergens.map((a) => ALLERGEN_LABELS[snapshot.locale][a]).join(', ')
        : l.noAllergens,
    style: 'body',
    margin: [0, 0, 0, 12],
  })

  // Preparation
  if (snapshot.instructions) {
    content.push({ text: l.preparation, style: 'section' })
    content.push({ text: snapshot.instructions, style: 'body', margin: [0, 0, 0, 12] })
  }
  if (snapshot.notes) {
    content.push({ text: l.notes, style: 'section' })
    content.push({ text: snapshot.notes, style: 'body', margin: [0, 0, 0, 12] })
  }
  if (snapshot.storageRecommendation) {
    content.push({ text: l.storage, style: 'section' })
    content.push({ text: snapshot.storageRecommendation, style: 'body', margin: [0, 0, 0, 12] })
  }

  return {
    pageSize: 'A4',
    pageMargins: [48, 56, 48, 56],
    info: { title: snapshot.title },
    content,
    styles: {
      title: { fontSize: 22, bold: true, color: BROWN },
      meta: { fontSize: 10, color: MUTED },
      section: { fontSize: 13, bold: true, color: GOLD, margin: [0, 8, 0, 4] },
      body: { fontSize: 11, color: BROWN, lineHeight: 1.3 },
      footer: { fontSize: 8, color: MUTED },
    },
    footer: () => ({
      columns: [
        { text: snapshot.clinicName ?? l.generatedBy, style: 'footer', margin: [48, 0, 0, 0] },
      ],
    }),
    defaultStyle: { fontSize: 11, color: BROWN },
  }
}

export const PDF_BRAND = { GOLD, OLIVE, BROWN, MUTED }
