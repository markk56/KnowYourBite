import { z } from 'zod'
import type { FoodPreferenceCategory } from './foodPreferences'

/**
 * Assessments contract (Milestone 2) — the schema-driven anamnesis engine (ADR
 * D4). The questionnaire itself is DATA (`ASSESSMENT_SECTIONS`): a new question
 * or a new type drops in here with no component changes. Localized labels live
 * on the descriptors (the questionnaire is content, not UI chrome), so the form
 * engine renders `field.label[locale]` directly.
 *
 * Two anamneses are represented: the Standard form (sections 1–9 + info) and the
 * Sports form (= Standard + three extra `appliesTo: 'sports'` sections). This
 * maps 1:1 onto the client's `client_type`.
 *
 * The five Harris–Benedict inputs (sex, age, height, weight, activity factor) are
 * NEVER in `payload` — they are first-class fields bound via `field.bind`, so the
 * deterministic math in `@kyb/domain` never parses free-form JSON.
 *
 * Structured answers: beyond primitives, `payload` values may be one of a small,
 * bounded set of shapes (chip selections, quantity+unit, timed diary entries,
 * repeating rows). Legacy free-text answers for reworked questions remain valid
 * payload values — controls tolerate them and the AI prompt still includes them.
 */

// ── Enums ────────────────────────────────────────────────────────────────────

export const ASSESSMENT_TYPES = ['standard', 'sports'] as const
export type AssessmentType = (typeof ASSESSMENT_TYPES)[number]

/** Full lifecycle (superset of the M1 client-level status). */
export const ASSESSMENT_LIFECYCLE_STATUSES = ['unfinished', 'ai_proposed', 'completed', 'discarded'] as const
export type AssessmentLifecycleStatus = (typeof ASSESSMENT_LIFECYCLE_STATUSES)[number]

export const SEXES = ['male', 'female'] as const
export type Sex = (typeof SEXES)[number]

/** Was each approved value AI-accepted, AI-edited, or dietitian-authored? */
export const AI_DECISIONS = ['accepted', 'edited', 'rejected'] as const
export type AiDecision = (typeof AI_DECISIONS)[number]

/** AI audit feature tags (must match the DB `ai_feature` enum). */
export const AI_FEATURES = [
  'clinical_narrative',
  'allergen_suggestion',
  'mealplan_chat',
  'patient_friendly',
  'food_translation',
] as const
export type AiFeature = (typeof AI_FEATURES)[number]

/** Recurrence period for frequency answers (5× per day / week / month, or free-form). */
export const FREQUENCY_PERIODS = ['day', 'week', 'month', 'other'] as const
export type FrequencyPeriod = (typeof FREQUENCY_PERIODS)[number]

// ── Field registry types ─────────────────────────────────────────────────────

export interface LocalizedText {
  en: string
  hu: string
  ro: string
}

export type AssessmentFieldKind =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'scale'
  | 'time'
  | 'yesno'
  | 'date'
  | 'multiselect'
  | 'quantityUnit'
  | 'timedText'
  | 'repeater'
  | 'frequency'
  | 'mealPicker'

export interface FieldOption {
  value: string
  label: LocalizedText
}

export type RepeaterColumnKind = 'text' | 'number' | 'date'

/** One column of a repeater row (e.g. surgery description + its date). */
export interface RepeaterColumn {
  key: string
  label: LocalizedText
  kind: RepeaterColumnKind
  unit?: string
  placeholder?: LocalizedText
  /** Render only once the named sibling column has a value (date after text). */
  showWhenFilled?: string
}

/** Conditional visibility: `key` is 'sex' or another field's payload key (other HB binds are not resolvable). */
export interface VisibleIf {
  key: string
  equals: string | boolean
}

export interface AssessmentField {
  key: string
  label: LocalizedText
  kind: AssessmentFieldKind
  unit?: string
  /** Selectable entries: select choices, multiselect/frequency chips, quantityUnit units. */
  options?: FieldOption[]
  placeholder?: LocalizedText
  /** First-class Harris–Benedict / activity binding; otherwise stored in `payload[key]`. */
  bind?: 'sex' | 'ageYears' | 'heightCm' | 'weightKg' | 'activityFactor'
  scaleMin?: number
  scaleMax?: number
  /** multiselect: offer a free-text "other" entry alongside the chips. */
  allowOther?: boolean
  /** frequency: let the dietitian add custom items beyond `options`. */
  allowCustomItems?: boolean
  /** repeater: the columns of each row. */
  columns?: RepeaterColumn[]
  /** mealPicker: which nomenclator list feeds the chips. */
  nomenclatorCategory?: FoodPreferenceCategory
  /** Render only when the referenced answer matches (pruned from saves otherwise). */
  visibleIf?: VisibleIf
}

export interface AssessmentSubgroup {
  key: string
  label: LocalizedText
  fields: AssessmentField[]
  /** Render only when the referenced answer matches (e.g. women's health ⇔ sex=female). */
  visibleIf?: VisibleIf
}

export interface AssessmentSection {
  id: string
  title: LocalizedText
  icon: string
  appliesTo: 'all' | 'sports'
  fields?: AssessmentField[]
  subgroups?: AssessmentSubgroup[]
  /** Informational-only section (e.g. reminders) — no inputs collected. */
  note?: LocalizedText
}

// Small helpers to keep the registry readable.
const L = (en: string, hu: string, ro: string): LocalizedText => ({ en, hu, ro })
const text = (key: string, label: LocalizedText): AssessmentField => ({ key, label, kind: 'text' })
const area = (key: string, label: LocalizedText, placeholder?: LocalizedText): AssessmentField => ({
  key,
  label,
  kind: 'textarea',
  ...(placeholder ? { placeholder } : {}),
})
const num = (key: string, label: LocalizedText, unit: string): AssessmentField => ({
  key,
  label,
  kind: 'number',
  unit,
})
const scale = (key: string, label: LocalizedText): AssessmentField => ({ key, label, kind: 'scale' })
const yesno = (key: string, label: LocalizedText): AssessmentField => ({ key, label, kind: 'yesno' })

export const WEEKDAY_OPTIONS: FieldOption[] = [
  { value: 'monday', label: L('Monday', 'Hétfő', 'Luni') },
  { value: 'tuesday', label: L('Tuesday', 'Kedd', 'Marți') },
  { value: 'wednesday', label: L('Wednesday', 'Szerda', 'Miercuri') },
  { value: 'thursday', label: L('Thursday', 'Csütörtök', 'Joi') },
  { value: 'friday', label: L('Friday', 'Péntek', 'Vineri') },
  { value: 'saturday', label: L('Saturday', 'Szombat', 'Sâmbătă') },
  { value: 'sunday', label: L('Sunday', 'Vasárnap', 'Duminică') },
]

// ── The questionnaire (Standard = shared sections + reminders; Sports adds S1–S3) ─

export const ASSESSMENT_SECTIONS: AssessmentSection[] = [
  {
    id: 'basics',
    icon: '🧍',
    title: L('Basic data', 'Alapadatok', 'Date de bază'),
    appliesTo: 'all',
    fields: [
      {
        key: 'sex',
        bind: 'sex',
        kind: 'select',
        label: L('Sex', 'Nem', 'Sex'),
        options: [
          { value: 'male', label: L('Male', 'Férfi', 'Bărbat') },
          { value: 'female', label: L('Female', 'Nő', 'Femeie') },
        ],
      },
      { key: 'ageYears', bind: 'ageYears', kind: 'number', unit: 'yr', label: L('Age', 'Életkor', 'Vârstă') },
      { ...num('heightCm', L('Height', 'Magasság', 'Înălțime'), 'cm'), bind: 'heightCm' },
      { ...num('weightKg', L('Body weight', 'Testtömeg', 'Greutate corporală'), 'kg'), bind: 'weightKg' },
      text('occupation', L('Occupation', 'Foglalkozás', 'Ocupație')),
    ],
  },
  {
    id: 'medical',
    icon: '🩺',
    title: L('Medical history', 'Orvosi és egészségügyi előzmények', 'Antecedente medicale'),
    appliesTo: 'all',
    fields: [
      area(
        'diseases',
        L('Current / past illnesses', 'Milyen betegségei vannak / voltak?', 'Ce boli aveți / ați avut?'),
        L(
          'e.g. hypertension, cardiovascular, diabetes, kidney, liver, digestive, respiratory, joints, thyroid, sleep, allergies, stress',
          'pl. magas vérnyomás, szív- és érrendszeri, cukorbetegség, vese, máj, emésztőrendszeri, légzőszervi, csont-ízületi, pajzsmirigy, alvászavar, allergiák, stressz',
          'ex. hipertensiune, cardiovascular, diabet, rinichi, ficat, digestiv, respirator, articulații, tiroidă, somn, alergii, stres',
        ),
      ),
      area(
        'medications',
        L(
          'Current medications / supplements',
          'Milyen gyógyszereket, étrend-kiegészítőket szed jelenleg?',
          'Ce medicamente / suplimente luați în prezent?',
        ),
      ),
      area(
        'familyDiseases',
        L(
          'Family history of illness',
          'Családban előforduló betegségek (pl. diabétesz, szív-érrendszeri)',
          'Boli în familie (ex. diabet, cardiovascular)',
        ),
      ),
      {
        key: 'hospitalizations',
        kind: 'repeater',
        label: L(
          'Hospital treatments / surgeries',
          'Volt-e kórházi kezelése, műtéte?',
          'Tratamente spitalicești / operații',
        ),
        columns: [
          {
            key: 'treatment',
            kind: 'text',
            label: L('Treatment / surgery', 'Kezelés / műtét', 'Tratament / operație'),
            placeholder: L('e.g. appendectomy', 'pl. vakbélműtét', 'ex. apendicectomie'),
          },
          { key: 'date', kind: 'date', label: L('Date', 'Dátum', 'Data'), showWhenFilled: 'treatment' },
        ],
      },
      yesno(
        'foodAllergyHas',
        L(
          'Known food allergy or intolerance?',
          'Van-e ismert ételallergiája vagy intoleranciája?',
          'Alergie sau intoleranță alimentară cunoscută?',
        ),
      ),
      {
        key: 'foodAllergyItems',
        kind: 'multiselect',
        allowOther: true,
        visibleIf: { key: 'foodAllergyHas', equals: true },
        label: L('Which ones?', 'Melyek ezek?', 'Care sunt acestea?'),
        options: [
          { value: 'gluten', label: L('Gluten', 'Glutén', 'Gluten') },
          { value: 'lactose', label: L('Lactose', 'Laktóz', 'Lactoză') },
          { value: 'milk_protein', label: L('Milk protein', 'Tejfehérje', 'Proteine din lapte') },
          { value: 'egg', label: L('Egg', 'Tojás', 'Ou') },
          { value: 'peanut', label: L('Peanut', 'Földimogyoró', 'Arahide') },
          { value: 'tree_nuts', label: L('Tree nuts', 'Diófélék', 'Nuci') },
          { value: 'soy', label: L('Soy', 'Szója', 'Soia') },
          { value: 'fish', label: L('Fish', 'Hal', 'Pește') },
          { value: 'shellfish', label: L('Shellfish / seafood', 'Rák, kagyló (tenger gyümölcsei)', 'Fructe de mare') },
          { value: 'sesame', label: L('Sesame', 'Szezámmag', 'Susan') },
          { value: 'mustard', label: L('Mustard', 'Mustár', 'Muștar') },
          { value: 'celery', label: L('Celery', 'Zeller', 'Țelină') },
          { value: 'histamine', label: L('Histamine', 'Hisztamin', 'Histamină') },
          { value: 'fructose', label: L('Fructose', 'Fruktóz', 'Fructoză') },
        ],
      },
    ],
    subgroups: [
      {
        key: 'womensHealth',
        label: L("Women's health", 'Női egészség', 'Sănătatea femeii'),
        visibleIf: { key: 'sex', equals: 'female' },
        fields: [
          text(
            'menstrualCycle',
            L(
              'Is your menstrual cycle regular? (yes/no, painful, skipped)',
              'Rendszeres-e a menstruációs ciklusa? (igen/nem, fájdalmas, kimarad)',
              'Ciclul menstrual este regulat? (da/nu, dureros, lipsește)',
            ),
          ),
          num(
            'cycleLength',
            L('Usual cycle length', 'Hány napos a ciklusa általában?', 'Durata obișnuită a ciclului'),
            'days',
          ),
          {
            key: 'pmsSymptoms',
            kind: 'multiselect',
            allowOther: true,
            label: L('PMS symptoms', 'PMS tünetek', 'Simptome PMS'),
            options: [
              { value: 'mood_swings', label: L('Mood swings', 'Hangulatingadozás', 'Schimbări de dispoziție') },
              { value: 'bloating', label: L('Bloating', 'Puffadás', 'Balonare') },
              { value: 'cramps', label: L('Cramps', 'Görcsök', 'Crampe') },
              { value: 'headache', label: L('Headache', 'Fejfájás', 'Dureri de cap') },
              { value: 'sweet_cravings', label: L('Sweet cravings', 'Édesség utáni vágy', 'Poftă de dulce') },
              { value: 'acne', label: L('Acne', 'Pattanások', 'Acnee') },
            ],
          },
          text(
            'hormonalTreatment',
            L(
              'Hormonal treatment (contraception, HRT)?',
              'Van hormonális kezelése (pl. fogamzásgátló, hormonpótlás)?',
              'Tratament hormonal (contraceptive, terapie de substituție)?',
            ),
          ),
          text(
            'pregnancies',
            L('Pregnancies / number of births', 'Volt terhessége / hány szülése volt?', 'Sarcini / număr de nașteri'),
          ),
          text('miscarriages', L('Miscarriages', 'Volt vetélése?', 'Avorturi spontane')),
          text(
            'breastfeeding',
            L(
              'Breastfed, and for how long?',
              'Szoptatott-e, és ha igen, mennyi ideig?',
              'Ați alăptat și cât timp?',
            ),
          ),
          yesno(
            'menopauseEntered',
            L('Reached menopause?', 'Belépett-e már a menopauzába?', 'Ați intrat la menopauză?'),
          ),
          {
            key: 'menopauseDate',
            kind: 'date',
            visibleIf: { key: 'menopauseEntered', equals: true },
            label: L('If yes, when?', 'Ha igen, mikor?', 'Dacă da, când?'),
          },
        ],
      },
    ],
  },
  {
    id: 'weightHistory',
    icon: '⚖️',
    title: L('Weight & health history', 'Testsúly- és egészségtörténet', 'Istoric greutate și sănătate'),
    appliesTo: 'all',
    fields: [
      text(
        'weightChange',
        L(
          'Significant recent weight change (loss / gain)?',
          'Volt-e az utóbbi időben jelentős testsúlyváltozása (fogyás / hízás)?',
          'Schimbare recentă semnificativă de greutate (scădere / creștere)?',
        ),
      ),
      text(
        'pastDiets',
        L(
          'Tried any diet on your own before?',
          'Próbált-e korábban valamilyen diétát vagy étrendet önállóan?',
          'Ați încercat vreo dietă pe cont propriu?',
        ),
      ),
      text(
        'seenDietitian',
        L('Seen a dietitian before?', 'Volt-e már korábban dietetikusnál?', 'Ați mai fost la un dietetician?'),
      ),
      text('dietitianExperience', L('What was your experience?', 'Milyen tapasztalatai voltak?', 'Ce experiență ați avut?')),
      text(
        'dietitianResults',
        L(
          'Did you feel results (weight, energy, wellbeing)?',
          'Érzett-e eredményt (pl. fogyás, energiaszint, jobb közérzet)?',
          'Ați simțit rezultate (greutate, energie, stare de bine)?',
        ),
      ),
      text('dietitianStopReason', L('Why did you stop?', 'Mi miatt hagyta abba?', 'De ce ați renunțat?')),
      text(
        'dietitianWantDifferent',
        L('What would you do differently now?', 'Mi az, amit most másképp szeretne?', 'Ce ați face diferit acum?'),
      ),
    ],
  },
  {
    id: 'digestion',
    icon: '😌',
    title: L('Digestion & wellbeing', 'Emésztési és közérzeti szokások', 'Digestie și stare generală'),
    appliesTo: 'all',
    fields: [
      text(
        'bowel',
        L('Constipation or diarrhea?', 'Van-e székrekedése vagy hasmenése?', 'Constipație sau diaree?'),
      ),
      text(
        'bloating',
        L(
          'Bloating, reflux, digestive complaints?',
          'Tapasztal-e puffadást, refluxot, emésztési panaszt?',
          'Balonare, reflux, probleme digestive?',
        ),
      ),
      text(
        'sleep',
        L(
          'How do you sleep? Fall asleep easily, wake at night?',
          'Milyen az alvása? Könnyen elalszik, felébred-e éjszaka?',
          'Cum dormiți? Adormiți ușor, vă treziți noaptea?',
        ),
      ),
      scale('energyLevel', L('Daily energy level (1–10)', 'Napi energiaszint (1–10)', 'Nivel de energie zilnic (1–10)')),
      scale('stressLevel', L('Stress level (1–10)', 'Stresszszint (1–10)', 'Nivel de stres (1–10)')),
    ],
  },
  {
    id: 'eating',
    icon: '🍽️',
    title: L('Eating habits', 'Étkezési szokások', 'Obiceiuri alimentare'),
    appliesTo: 'all',
    fields: [
      text(
        'foodSourcing',
        L('Where do you get your food?', 'Honnan szerzi be az élelmiszereket?', 'De unde vă procurați alimentele?'),
      ),
      area(
        'cookingAtHome',
        L(
          'Who cooks at home? Where do you usually eat? (home, restaurant, canteen)',
          'Ki főz otthon? Hol étkezik általában? (otthon, étterem, munkahelyi menza)',
          'Cine gătește acasă? Unde mâncați de obicei? (acasă, restaurant, cantină)',
        ),
      ),
      text('favoriteFoods', L('Favorite foods', 'Milyen ételeket szeret leginkább?', 'Mâncărurile preferate')),
      text('dislikedFoods', L('Disliked foods', 'Milyen ételeket nem szeret?', 'Mâncăruri pe care nu le agreați')),
      {
        key: 'waterIntake',
        kind: 'quantityUnit',
        label: L('How much water per day?', 'Mennyi vizet fogyaszt naponta?', 'Câtă apă consumați pe zi?'),
        options: [
          { value: 'glass', label: L('glasses', 'pohár', 'pahare') },
          { value: 'dl', label: L('dl', 'dl', 'dl') },
          { value: 'l', label: L('litres', 'liter', 'litri') },
        ],
      },
      {
        key: 'consumptionFrequency',
        kind: 'frequency',
        label: L(
          'How often: coffee, tea, soft drinks, alcohol, meat, dairy, eggs, vegetables, fruit',
          'Mennyire gyakran: kávé, tea, üdítő, alkohol, hús, tejtermék, tojás, zöldség, gyümölcs',
          'Cât de des: cafea, ceai, băuturi carbogazoase, alcool, carne, lactate, ouă, legume, fructe',
        ),
        options: [
          { value: 'coffee', label: L('Coffee', 'Kávé', 'Cafea') },
          { value: 'tea', label: L('Tea', 'Tea', 'Ceai') },
          { value: 'soft_drinks', label: L('Soft drinks', 'Üdítő', 'Băuturi carbogazoase') },
          { value: 'alcohol', label: L('Alcohol', 'Alkohol', 'Alcool') },
          { value: 'meat', label: L('Meat', 'Hús', 'Carne') },
          { value: 'dairy', label: L('Dairy', 'Tejtermék', 'Lactate') },
          { value: 'eggs', label: L('Eggs', 'Tojás', 'Ouă') },
          { value: 'vegetables', label: L('Vegetables', 'Zöldség', 'Legume') },
          { value: 'fruit', label: L('Fruit', 'Gyümölcs', 'Fructe') },
        ],
      },
      text(
        'sweetsFrequency',
        L('Sweets — frequency & type', 'Édességfogyasztás gyakorisága és típusa', 'Dulciuri — frecvență și tip'),
      ),
      text(
        'saltySnacksFrequency',
        L('Salty snacks — frequency & type', 'Sós nasi fogyasztás gyakorisága és típusa', 'Gustări sărate — frecvență și tip'),
      ),
      text(
        'cookingFat',
        L('Fat used for cooking', 'Milyen zsiradékot használ főzéshez?', 'Ce grăsime folosiți la gătit?'),
      ),
      text(
        'cookingMethods',
        L(
          'Cooking methods (pan/oven frying, boiling, steaming)',
          'Milyen elkészítési módokat használ (sütés serpenyőben/sütőben, főzés, párolás)',
          'Metode de gătit (prăjire în tigaie/cuptor, fierbere, la abur)',
        ),
      ),
    ],
  },
  {
    id: 'routine',
    icon: '🕗',
    title: L('Daily routine', 'Napi rutin', 'Rutină zilnică'),
    appliesTo: 'all',
    fields: [
      { key: 'wakeTime', kind: 'time', label: L('Wake-up time', 'Mikor kel reggel?', 'Ora de trezire') },
      { key: 'sleepTime', kind: 'time', label: L('Bedtime', 'Mikor fekszik le este?', 'Ora de culcare') },
      text(
        'routineRegularity',
        L(
          'Is your daily routine regular or variable?',
          'Van rendszer a napirendjében, vagy inkább változó?',
          'Rutina zilnică este regulată sau variabilă?',
        ),
      ),
    ],
  },
  {
    id: 'recall',
    icon: '🕛',
    title: L('Typical day (24h recall)', 'Egy átlagos nap (24 órás visszaidézés)', 'O zi obișnuită (rememorare 24h)'),
    appliesTo: 'all',
    fields: [
      { key: 'breakfast', kind: 'timedText', label: L('Breakfast', 'Reggeli', 'Mic dejun') },
      { key: 'snack1', kind: 'timedText', label: L('Snack', 'Nasi', 'Gustare') },
      { key: 'lunch', kind: 'timedText', label: L('Lunch', 'Ebéd', 'Prânz') },
      { key: 'snack2', kind: 'timedText', label: L('Snack', 'Nasi', 'Gustare') },
      { key: 'dinner', kind: 'timedText', label: L('Dinner', 'Vacsora', 'Cină') },
      { key: 'snack3', kind: 'timedText', label: L('Snack', 'Nasi', 'Gustare') },
    ],
  },
  {
    id: 'mealPreferences',
    icon: '🍲',
    title: L('Meal preferences', 'Étkezési preferenciák', 'Preferințe alimentare'),
    appliesTo: 'all',
    fields: [
      {
        key: 'repeatedDishes',
        kind: 'repeater',
        label: L(
          'Which dish repeats, and how many times?',
          'Melyik fogás ismétlődik és mennyiszer?',
          'Ce fel de mâncare se repetă și de câte ori?',
        ),
        placeholder: L(
          'e.g. a pot of soup eaten over 3 meals',
          'pl. egy fazék leves 3 étkezésre elosztva',
          'ex. o oală de supă mâncată la 3 mese',
        ),
        columns: [
          {
            key: 'dish',
            kind: 'text',
            label: L('Dish', 'Fogás', 'Fel de mâncare'),
            placeholder: L('e.g. soup', 'pl. húsleves', 'ex. supă'),
          },
          {
            key: 'times',
            kind: 'number',
            unit: '×',
            label: L('How many times?', 'Hány alkalommal fogyasztja?', 'De câte ori?'),
            showWhenFilled: 'dish',
          },
        ],
      },
      {
        key: 'cookingDays',
        kind: 'multiselect',
        label: L(
          'Which days do you usually have time to cook?',
          'Melyik napokon van inkább ideje főzni?',
          'În ce zile aveți de obicei timp să gătiți?',
        ),
        options: WEEKDAY_OPTIONS,
      },
      {
        key: 'recipeOpenness',
        kind: 'select',
        label: L(
          'How open are you to trying new recipes?',
          'Mennyire szeretne új recepteket kipróbálni?',
          'Cât de deschis sunteți să încercați rețete noi?',
        ),
        options: [
          { value: 'full_reset', label: L('A completely new lifestyle', 'Teljesen új életmód', 'Un stil de viață complet nou') },
          { value: 'loves_new', label: L('Loves novelty', 'Szereti az újdonságot', 'Îi plac noutățile') },
          {
            value: 'couple_per_week',
            label: L('1–2 new recipes a week', 'Jöhet 1–2 új recept hetente', '1–2 rețete noi pe săptămână'),
          },
          { value: 'keep_usual', label: L('Only the usual', 'Csak a megszokott', 'Doar cele obișnuite') },
        ],
      },
    ],
    subgroups: [
      {
        key: 'usualMeals',
        label: L(
          'Typical meals — tick what the client usually eats',
          'Tipikus ételek — pipálja ki, amiket fogyasztani szokott',
          'Mese tipice — bifați ce obișnuiește să mănânce',
        ),
        fields: [
          {
            key: 'favBreakfasts',
            kind: 'mealPicker',
            nomenclatorCategory: 'breakfast',
            label: L('Breakfasts', 'Reggelik', 'Mic dejun'),
          },
          {
            key: 'favLunches',
            kind: 'mealPicker',
            nomenclatorCategory: 'lunch',
            label: L('Lunches', 'Ebédek', 'Prânzuri'),
          },
          {
            key: 'favDinners',
            kind: 'mealPicker',
            nomenclatorCategory: 'dinner',
            label: L('Dinners', 'Vacsorák', 'Cine'),
          },
          {
            key: 'favSnacks',
            kind: 'mealPicker',
            nomenclatorCategory: 'snack',
            label: L('Snacks', 'Nasik', 'Gustări'),
          },
          {
            key: 'favDesserts',
            kind: 'mealPicker',
            nomenclatorCategory: 'dessert',
            label: L('Desserts', 'Desszertek', 'Deserturi'),
          },
        ],
      },
    ],
  },
  {
    id: 'lifestyle',
    icon: '🏃',
    title: L('Lifestyle & physical activity', 'Életmód és fizikai aktivitás', 'Stil de viață și activitate fizică'),
    appliesTo: 'all',
    fields: [
      text(
        'workActivity',
        L(
          'Physical activity at work',
          'Milyen fizikai aktivitást végez a munkája során?',
          'Ce activitate fizică aveți la locul de muncă?',
        ),
      ),
      {
        key: 'activityFactor',
        bind: 'activityFactor',
        kind: 'select',
        label: L(
          'Sedentary or active lifestyle?',
          'Ülő vagy aktív életmódot folytat?',
          'Stil de viață sedentar sau activ?',
        ),
        options: [
          {
            value: '1.2',
            label: L('Sedentary (desk job, little movement)', 'Ülő (irodai, kevés mozgás)', 'Sedentar (birou, mișcare redusă)'),
          },
          {
            value: '1.375',
            label: L(
              'Lightly active (1–3 workouts / week)',
              'Enyhén aktív (heti 1–3 edzés)',
              'Ușor activ (1–3 antrenamente / săptămână)',
            ),
          },
          {
            value: '1.55',
            label: L(
              'Moderately active (3–5 workouts / week)',
              'Mérsékelten aktív (heti 3–5 edzés)',
              'Moderat activ (3–5 antrenamente / săptămână)',
            ),
          },
          {
            value: '1.725',
            label: L(
              'Very active (6–7 workouts / week)',
              'Nagyon aktív (heti 6–7 edzés)',
              'Foarte activ (6–7 antrenamente / săptămână)',
            ),
          },
          {
            value: '1.9',
            label: L(
              'Extremely active (physical job + daily training)',
              'Rendkívül aktív (fizikai munka + napi edzés)',
              'Extrem de activ (muncă fizică + antrenament zilnic)',
            ),
          },
        ],
      },
      {
        key: 'sportActivity',
        kind: 'frequency',
        allowCustomItems: true,
        label: L(
          'Sport activity — which sport and how often?',
          'Sporttevékenység — milyen sport és milyen gyakran?',
          'Activitate sportivă — ce sport și cât de des?',
        ),
        options: [
          { value: 'running', label: L('Running', 'Futás', 'Alergare') },
          { value: 'cycling', label: L('Cycling', 'Kerékpározás', 'Ciclism') },
          { value: 'gym', label: L('Gym / weight training', 'Konditerem / súlyzós edzés', 'Sală / antrenament cu greutăți') },
          { value: 'swimming', label: L('Swimming', 'Úszás', 'Înot') },
          { value: 'football', label: L('Football', 'Foci', 'Fotbal') },
          { value: 'walking_hiking', label: L('Walking / hiking', 'Séta / túrázás', 'Plimbare / drumeții') },
          { value: 'yoga_pilates', label: L('Yoga / pilates', 'Jóga / pilates', 'Yoga / pilates') },
        ],
      },
    ],
  },
  {
    id: 'observation',
    icon: '🔎',
    title: L('Objective examination', 'Objektív vizsgálat / megfigyelés', 'Examen obiectiv'),
    appliesTo: 'all',
    fields: [
      text('hair', L('Hair', 'Haj', 'Păr')),
      text('nails', L('Nails', 'Körmök', 'Unghii')),
      text('skin', L('Skin', 'Bőr', 'Piele')),
    ],
    subgroups: [
      {
        key: 'circumference',
        label: L('Circumference measurements (cm)', 'Testkörfogat mérések (cm)', 'Măsurători de circumferință (cm)'),
        fields: [
          num('waistCm', L('Waist', 'Derék', 'Talie'), 'cm'),
          num('hipCm', L('Hip', 'Csípő', 'Șold'), 'cm'),
          num('thighCm', L('Thigh', 'Comb', 'Coapsă'), 'cm'),
          num('armCm', L('Arm', 'Kar', 'Braț'), 'cm'),
        ],
      },
    ],
  },
  {
    id: 'goals',
    icon: '🎯',
    title: L('Motivation & goals', 'Motiváció és célok', 'Motivație și obiective'),
    appliesTo: 'all',
    fields: [
      text(
        'whyDietitian',
        L('Why did you seek a dietitian now?', 'Miért keresett most fel dietetikust?', 'De ce ați apelat acum la un dietetician?'),
      ),
      text('mainGoal', L('Most important goal', 'Mi a legfontosabb célja?', 'Cel mai important obiectiv')),
      text(
        'timeCommitment',
        L(
          'How much time can you commit to change?',
          'Mennyi időt szeretne rászánni az életmódváltásra?',
          'Cât timp puteți dedica schimbării?',
        ),
      ),
      scale('motivationLevel', L('How motivated are you? (1–10)', 'Mennyire motivált? (1–10)', 'Cât de motivat sunteți? (1–10)')),
      text(
        'supportNeeded',
        L(
          'What would help you stick with it long-term?',
          'Mi segítené önt abban, hogy tartósan kitartson?',
          'Ce v-ar ajuta să perseverați pe termen lung?',
        ),
      ),
    ],
  },
  {
    id: 'reminders',
    icon: '📸',
    title: L("Don't forget", 'Ne feledje', 'Nu uitați'),
    appliesTo: 'all',
    note: L(
      'Once a month, in the morning on an empty stomach, in the same room and fitted/sports clothing, take three photos: front, side and back. The diet is compiled from the assessment and measurements and sent in printable form within five working days.',
      'Készítsen havonta egyszer, reggel éhgyomorra, ugyanabban a helyiségben, testhezálló vagy sportos ruhában három fotót: elölről, oldalról és hátulról. Az étrendet az anamnézis és a mérések alapján állítom össze, és öt munkanapon belül kinyomtatható formában küldöm.',
      'O dată pe lună, dimineața pe stomacul gol, în aceeași cameră și în haine mulate sau sport, faceți trei fotografii: din față, din lateral și din spate. Dieta este întocmită pe baza anamnezei și a măsurătorilor și trimisă în formă printabilă în cinci zile lucrătoare.',
    ),
  },
  // ── Sports-only sections (page 5 of the sports anamnesis) ───────────────────
  {
    id: 'training',
    icon: '🏋️',
    title: L('Training characteristics', 'Edzési jellemzők', 'Caracteristici de antrenament'),
    appliesTo: 'sports',
    fields: [
      text(
        'sportType',
        L(
          'Which sport exactly? (e.g. weight training, crossfit, running)',
          'Milyen sportot űz pontosan? (pl. súlyzós edzés, crossfit, futás)',
          'Ce sport practicați exact? (ex. antrenament cu greutăți, crossfit, alergare)',
        ),
      ),
      text(
        'trainingFrequency',
        L(
          'Sessions per week and typical duration',
          'Hány alkalommal edz hetente, és átlagosan mennyi ideig?',
          'Câte sesiuni pe săptămână și durata medie',
        ),
      ),
      {
        key: 'trainingPhase',
        kind: 'select',
        label: L('Current training phase', 'Jelenlegi edzésfázis', 'Faza actuală de antrenament'),
        options: [
          { value: 'muscle_gain', label: L('Muscle gain', 'Izomtömeg-növelés', 'Creștere masă musculară') },
          {
            value: 'cutting',
            label: L('Cutting / fat loss', 'Szálkásítás / zsírcsökkentés', 'Definire / reducerea grăsimii'),
          },
          {
            value: 'maintenance',
            label: L('Maintenance / recovery', 'Szintentartás / regeneráció', 'Menținere / regenerare'),
          },
        ],
      },
      text(
        'trainingTime',
        L('When do you usually train? (morning / afternoon / evening)', 'Mikor edz általában? (délelőtt / délután / este)', 'Când vă antrenați de obicei? (dimineață / după-amiază / seara)'),
      ),
      text(
        'muscleGroups',
        L(
          'Main exercises / muscle groups trained',
          'Milyen fő gyakorlatokat vagy izomcsoportokat edz?',
          'Principalele exerciții / grupe musculare antrenate',
        ),
      ),
      num('restDays', L('Rest days per week', 'Hány pihenőnapja van hetente?', 'Zile de odihnă pe săptămână'), 'days'),
      text(
        'recovery',
        L(
          'How is your recovery? (soreness, sleep quality, fatigue)',
          'Milyen a regenerációja? (izomláz, alvásminőség, fáradtság)',
          'Cum este recuperarea? (febră musculară, calitatea somnului, oboseală)',
        ),
      ),
      text(
        'effectivenessMeasure',
        L(
          'How do you measure training effectiveness? (strength, physique, wellbeing)',
          'Hogyan méri az edzése hatékonyságát? (erőnövekedés, testkép, közérzet)',
          'Cum măsurați eficiența antrenamentului? (forță, fizic, stare de bine)',
        ),
      ),
    ],
  },
  {
    id: 'supplements',
    icon: '🥤',
    title: L('Supplements & hydration', 'Kiegészítők és hidratálás', 'Suplimente și hidratare'),
    appliesTo: 'sports',
    fields: [
      area(
        'supplements',
        L(
          'Protein, creatine or other supplements? How often and since when?',
          'Fogyaszt-e fehérjeport, kreatint, vagy más kiegészítőt? Ha igen, milyen gyakran és mióta?',
          'Consumați proteine, creatină sau alte suplimente? Cât de des și de când?',
        ),
      ),
      text(
        'supplementSideEffects',
        L(
          'Any side effects? (bloating, digestive issues)',
          'Volt-e mellékhatás? (pl. puffadás, emésztési panasz)',
          'Efecte secundare? (balonare, probleme digestive)',
        ),
      ),
      text(
        'hydrationSigns',
        L(
          'Frequent headaches, cramps or signs of dehydration?',
          'Tapasztal-e gyakori fejfájást, izomgörcsöt vagy kiszáradás-jelet?',
          'Dureri de cap frecvente, crampe sau semne de deshidratare?',
        ),
      ),
    ],
  },
  {
    id: 'composition',
    icon: '💪',
    title: L('Body-composition goals', 'Testkompozíciós célok', 'Obiective de compoziție corporală'),
    appliesTo: 'sports',
    fields: [
      text(
        'targetBodyParts',
        L(
          'Which body parts do you most want to change? (e.g. shoulders, thighs, waist)',
          'Mely testrészeken szeretne leginkább változást elérni? (pl. váll, comb, derék)',
          'Ce părți ale corpului doriți cel mai mult să schimbați? (ex. umeri, coapse, talie)',
        ),
      ),
      text(
        'compositionGoal',
        L(
          'Main goal (muscle gain, fat loss, strength, endurance)',
          'Mi a fő célja? (izomtömeg-növelés, zsírcsökkentés, erőfejlesztés, állóképesség)',
          'Obiectivul principal (masă musculară, reducerea grăsimii, forță, anduranță)',
        ),
      ),
      text('goalTimeframe', L('Target timeframe', 'Milyen időtávon szeretné elérni a célját?', 'Termenul-țintă')),
      text('goalMotivation', L('What drives this motivation?', 'Milyen motiváció vezérli ebben?', 'Ce vă motivează în acest sens?')),
    ],
  },
]

/** Sections applicable to a given assessment type (standard = all-but-sports). */
export function sectionsForType(type: AssessmentType): AssessmentSection[] {
  return ASSESSMENT_SECTIONS.filter((s) => s.appliesTo === 'all' || s.appliesTo === type)
}

// ── Zod schemas ──────────────────────────────────────────────────────────────

/** Harris–Benedict inputs — required before Finish-with-AI can compute anything. */
export const hbInputsSchema = z.object({
  sex: z.enum(SEXES),
  ageYears: z.number().int().min(1).max(120),
  heightCm: z.number().min(50).max(260),
  weightKg: z.number().min(20).max(400),
  activityFactor: z.number().min(1).max(2.2),
})
export type HbInputs = z.infer<typeof hbInputsSchema>

// Structured answer shapes. Each is bounded so a payload can never balloon; the
// union stays deliberately small — a new control means a new named shape here.

const payloadPrimitive = z.union([z.string().max(5000), z.number(), z.boolean()]).nullable()

/** Chip selections (+ optional free-text "other"): multiselect & mealPicker. */
export const selectionValueSchema = z.object({
  selected: z.array(z.string().max(300)).max(100),
  other: z.string().max(2000).nullable().optional(),
})
export type SelectionValue = z.infer<typeof selectionValueSchema>

/** A measured amount with its unit (e.g. daily water intake). */
export const quantityValueSchema = z.object({
  value: z.number().nullable(),
  unit: z.string().max(30),
})
export type QuantityValue = z.infer<typeof quantityValueSchema>

/** A diary entry: what + at which time (24h-recall rows). */
export const timedTextValueSchema = z.object({
  time: z.string().max(10),
  text: z.string().max(2000),
})
export type TimedTextValue = z.infer<typeof timedTextValueSchema>

/** One repeater/frequency row — a flat record of primitives (treatment+date, item+times+period…). */
export const entryRowSchema = z.record(
  z.string().max(40),
  z.union([z.string().max(2000), z.number(), z.boolean()]).nullable(),
)
export type EntryRow = z.infer<typeof entryRowSchema>

export const payloadValueSchema = z.union([
  payloadPrimitive,
  selectionValueSchema,
  quantityValueSchema,
  timedTextValueSchema,
  z.array(entryRowSchema).max(100),
])
export type AssessmentPayloadValue = z.infer<typeof payloadValueSchema>

/** Free-form questionnaire answers. Bounded value types + size; HB inputs are NOT here. */
export const assessmentPayloadSchema = z
  .record(z.string().max(80), payloadValueSchema)
  .refine((o) => Object.keys(o).length <= 300, { message: 'Too many answer fields' })
export type AssessmentPayload = z.infer<typeof assessmentPayloadSchema>

// ── Structured-value helpers (shared by the form engine and the AI serializer) ─

export function isSelectionValue(v: unknown): v is SelectionValue {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && Array.isArray((v as SelectionValue).selected)
}

export function isQuantityValue(v: unknown): v is QuantityValue {
  return (
    typeof v === 'object' && v !== null && !Array.isArray(v) && 'unit' in v && 'value' in v && !('selected' in v)
  )
}

export function isTimedTextValue(v: unknown): v is TimedTextValue {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false
  const c = v as Record<string, unknown>
  return typeof c.time === 'string' && typeof c.text === 'string'
}

export function isEntryRowArray(v: unknown): v is EntryRow[] {
  return Array.isArray(v) && v.every((r) => typeof r === 'object' && r !== null && !Array.isArray(r))
}

/** A row whose every cell is null/blank contributes nothing and is dropped on save. */
export function isEmptyEntryRow(row: EntryRow): boolean {
  return Object.values(row).every((c) => c == null || (typeof c === 'string' && c.trim() === ''))
}

/** True when an answer carries no information (drives autosave payload slimming). */
export function isEmptyPayloadValue(v: AssessmentPayloadValue | undefined): boolean {
  if (v === undefined || v === null) return true
  if (typeof v === 'string') return v.trim() === ''
  if (typeof v === 'number' || typeof v === 'boolean') return false
  if (Array.isArray(v)) return v.every(isEmptyEntryRow)
  if (isSelectionValue(v)) return v.selected.length === 0 && (v.other ?? '').trim() === ''
  if (isTimedTextValue(v)) return v.time.trim() === '' && v.text.trim() === ''
  if (isQuantityValue(v)) return v.value === null
  return false
}

// ── Conditional visibility + pruning ─────────────────────────────────────────

function resolveConditionValue(key: string, payload: AssessmentPayload, sex: Sex | null): unknown {
  return key === 'sex' ? sex : payload[key]
}

/** Evaluate a `visibleIf` condition against the current answers. */
export function matchesVisibleIf(
  cond: VisibleIf | undefined,
  payload: AssessmentPayload,
  sex: Sex | null,
): boolean {
  if (!cond) return true
  return resolveConditionValue(cond.key, payload, sex) === cond.equals
}

/** Payload keys retired from the questionnaire whose answers hide with a subgroup. */
const LEGACY_SUBGROUP_KEYS: Record<string, string[]> = {
  womensHealth: ['menopause'],
}

/**
 * Drop answers whose question is hidden by a failed `visibleIf` (e.g. the whole
 * women's-health block for a male client, or the menopause date after switching
 * back to "no"). Called before every draft save AND before the AI prompt is
 * built, so contradictory answers neither persist nor reach the model.
 */
export function pruneAssessmentPayload(payload: AssessmentPayload, sex: Sex | null): AssessmentPayload {
  const next: AssessmentPayload = { ...payload }
  const remove = (key: string) => {
    delete next[key]
  }
  for (const section of ASSESSMENT_SECTIONS) {
    for (const field of section.fields ?? []) {
      if (!field.bind && !matchesVisibleIf(field.visibleIf, payload, sex)) remove(field.key)
    }
    for (const group of section.subgroups ?? []) {
      const groupVisible = matchesVisibleIf(group.visibleIf, payload, sex)
      for (const field of group.fields) {
        if (field.bind) continue
        if (!groupVisible || !matchesVisibleIf(field.visibleIf, payload, sex)) remove(field.key)
      }
      if (!groupVisible) for (const legacy of LEGACY_SUBGROUP_KEYS[group.key] ?? []) remove(legacy)
    }
  }
  return next
}

const optionalHb = {
  sex: z.enum(SEXES).nullable().optional(),
  ageYears: z.number().int().min(1).max(120).nullable().optional(),
  heightCm: z.number().min(50).max(260).nullable().optional(),
  weightKg: z.number().min(20).max(400).nullable().optional(),
  activityFactor: z.number().min(1).max(2.2).nullable().optional(),
}

/** Autosave/update a draft: everything optional (a half-filled anamnesis is valid). */
export const assessmentDraftSchema = z.object({
  ...optionalHb,
  payload: assessmentPayloadSchema.optional(),
})
export type AssessmentDraftInput = z.infer<typeof assessmentDraftSchema>

/** The immutable AI proposal. NO absolute clinical numbers — only a bounded % suggestion. */
export const aiAssessmentProposalSchema = z.object({
  summary: z.string().min(1).max(4000),
  calorieAdjustmentPercent: z.number(), // clamped to ±30 server-side
  rationale: z.string().min(1).max(2000),
  focusAreas: z.array(z.string().max(200)).max(8).default([]),
})
export type AiAssessmentProposal = z.infer<typeof aiAssessmentProposalSchema>

/** Human-approved final targets (the only clinical numbers that persist). */
export const approveTargetsSchema = z.object({
  targetKcal: z.number().min(500).max(8000),
  proteinG: z.number().min(0).max(600),
  carbsG: z.number().min(0).max(1200),
  fatG: z.number().min(0).max(400),
  decisionSummary: z.enum(AI_DECISIONS),
})
export type ApproveTargetsInput = z.infer<typeof approveTargetsSchema>

// ── DTOs ─────────────────────────────────────────────────────────────────────

export interface AssessmentDto {
  id: string
  clientId: string
  version: number
  type: AssessmentType
  status: AssessmentLifecycleStatus
  sex: Sex | null
  ageYears: number | null
  heightCm: number | null
  weightKg: number | null
  activityFactor: number | null
  payload: AssessmentPayload
  aiProposal: AiAssessmentProposal | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

/** Deterministic clinical numbers — computed, authoritative, rounded for display. */
export interface DeterministicTargetsDto {
  bmrKcal: number
  maintenanceTdeeKcal: number
  targetKcal: number
  proteinG: number
  carbsG: number
  fatG: number
}

export interface AssessmentTargetsDto {
  id: string
  assessmentId: string
  clientId: string
  /** Null when body metrics weren't provided — targets were set by hand. */
  bmrKcal: number | null
  maintenanceTdeeKcal: number | null
  targetKcal: number
  proteinG: number
  carbsG: number
  fatG: number
  decisionSummary: AiDecision
  approvedAt: string
}

/**
 * Response of POST …/finish-with-ai. The deterministic block is present ONLY when
 * the five body metrics (sex/age/height/weight/activity) were provided — you can't
 * compute a BMR without them. It's null otherwise; the AI narrative still runs on
 * whatever the form contains, and the dietitian enters final targets by hand.
 */
export interface FinishWithAiResult {
  assessment: AssessmentDto
  /** Authoritative maintenance figures, or null when body metrics are incomplete. */
  deterministic: DeterministicTargetsDto | null
  ai:
    | {
        status: 'proposed'
        proposal: AiAssessmentProposal
        /** Maintenance re-computed with the AI's adjustment; null without metrics. */
        adjustedTargets: DeterministicTargetsDto | null
      }
    | { status: 'unavailable'; retryable: boolean }
}
