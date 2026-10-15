export type ProfileSegment = {
  name: string
  type: "sprint" | "climb" | "segment"
  fromKm: number
  toKm: number
  direction: "forward" | "reverse"
}

export type ProfileZoom = {
  title: string
  fromKm: number
  toKm: number
  matched: boolean
}

export type SprintSuggestion = {
  name: string
  laps: string
}

export type RaceProfile = {
  lapKm: number
  raceKm: number
  distanceKm: number[]
  altitudeM: number[]
  segments: ProfileSegment[]
  finish: ProfileZoom | null
  climbs: ProfileZoom[]
  sprints: SprintSuggestion[]
}

export function foldName(value: unknown): string

export function slugifyZwiftName(value: unknown): string

export function parseFinish(value: unknown): { pass: number; name: string } | null

export function prepareLap(
  distance: number[],
  altitude: number[],
  leadInKm: number,
  lapKm: number,
  latlng?: number[][]
): { distance: number[]; altitude: number[]; latlng: number[][] }

export function placeOnRoute(
  routeLatLng: number[][],
  routeDistanceM: number[],
  segmentLatLng: number[][]
): { fromM: number; toM: number } | null

export function raceDistanceKm(lapKm: number, lapsText: unknown, distanceText: unknown): number

export function buildRaceProfile(input: {
  distanceM: number[]
  altitudeM: number[]
  segments: ProfileSegment[]
  raceKm: number
  finishText?: string
  climbNames?: string[]
}): RaceProfile

export function profileImageSrc(series: string, routeName: string): string
