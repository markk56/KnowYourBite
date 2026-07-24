import { z } from 'zod'

/**
 * Food-preference nomenclator (Settings → tipikus ételek). Tenant-scoped lists of
 * popular breakfasts/lunches/dinners/snacks/desserts the dietitian ticks off in
 * the anamnesis. The dietitian curates the lists; assessments snapshot the LABEL
 * (not the id), so renaming/deleting an item never corrupts a stored anamnesis.
 */

export const FOOD_PREFERENCE_CATEGORIES = ['breakfast', 'lunch', 'dinner', 'snack', 'dessert'] as const
export type FoodPreferenceCategory = (typeof FOOD_PREFERENCE_CATEGORIES)[number]

export interface FoodPreferenceItemDto {
  id: string
  category: FoodPreferenceCategory
  label: string
  createdAt: string
}

export const foodPreferenceLabelSchema = z.string().trim().min(1).max(120)

export const createFoodPreferenceSchema = z.object({
  category: z.enum(FOOD_PREFERENCE_CATEGORIES),
  label: foodPreferenceLabelSchema,
})
export type CreateFoodPreferenceInput = z.infer<typeof createFoodPreferenceSchema>

export const updateFoodPreferenceSchema = z.object({
  label: foodPreferenceLabelSchema,
})
export type UpdateFoodPreferenceInput = z.infer<typeof updateFoodPreferenceSchema>
