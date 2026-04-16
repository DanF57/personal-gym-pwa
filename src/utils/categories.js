export const CATEGORIES = [
  { value: 'chest',     label: 'Chest' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'back',      label: 'Back' },
  { value: 'triceps',   label: 'Triceps' },
  { value: 'biceps',    label: 'Biceps' },
  { value: 'legs',      label: 'Legs' },
  { value: 'glutes',    label: 'Glutes' },
  { value: 'core',      label: 'Core' },
  { value: 'cardio',    label: 'Cardio' },
  { value: 'other',     label: 'Other' },
]

export const CATEGORY_MAP = Object.fromEntries(
  CATEGORIES.map(c => [c.value, c.label])
)
