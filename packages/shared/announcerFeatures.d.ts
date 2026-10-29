export type Feature = {
  key: string
  title: string
  pitch: string
  howTo: string
  links: string[]
  enabled: boolean
  isDefault: boolean
  isChanged: boolean
}

export type FeatureLinks = { siteOrigin: string; zwiftIdChannelId: string }

export function defaultFeatures(links: FeatureLinks): Array<Omit<Feature, 'enabled' | 'isDefault' | 'isChanged'>>

export function resolveFeatures(stored: unknown, links: FeatureLinks): Feature[]

export function sanitizeFeature(input: unknown): { title: string; pitch: string; howTo: string; links: string[]; enabled: boolean } | null
