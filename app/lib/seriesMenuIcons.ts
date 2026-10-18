export const SERIES_MENU_ICON_IDS = [
  'mountain',
  'climb',
  'road',
  'bike',
  'fifty',
  'glove',
  'target',
  'timer',
  'speed',
  'flash',
  'flag',
  'trophy',
  'medal',
  'podium',
  'laurel',
  'crown',
  'star',
  'fire',
  'bolt',
  'heart',
  'mask',
  'sun',
  'snow',
  'night',
  'calendar',
] as const

export type SeriesMenuIconId = (typeof SERIES_MENU_ICON_IDS)[number]

export function seriesMenuIconId(value: unknown): SeriesMenuIconId {
  const id = String(value || '').trim()
  return (SERIES_MENU_ICON_IDS as readonly string[]).includes(id) ? (id as SeriesMenuIconId) : 'mountain'
}
