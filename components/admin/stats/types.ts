export type GrowthSeriesPoint = {
  day: string
  added: number
  cumulative: number
}

export type GrowthResponse = {
  total: number
  estimatedJoinDates: number
  firstJoinDate: string | null
  series: GrowthSeriesPoint[]
  zwiftpower: {
    total: number
    estimated?: boolean
    series: { day: string; cumulative: number }[]
  }
}

export type DailyActivity = {
  date: string
  messages: number
  reactions: number
  voice: number
  interactions: number
  total: number
}

export type TopUser = {
  user_id: string
  username: string
  messages: number
  reactions: number
  voice: number
  interactions: number
  total: number
}

export type TopChannel = {
  channel_id: string
  channel_name: string
  messages: number
  reactions: number
  total: number
}

export type MemberPoint = {
  date: string
  members: number
  clubMembers: number | null
  presence: number | null
  estimated: boolean
}

export type StatsResponse = {
    period: { days: number | 'all'; start: string; end: string }
  totals: {
    messages: number
    reactions: number
    voice: number
    interactions: number
    uniqueUsers: number
    uniqueChannels: number
    daysWithActivity: number
    avgDailyMessages: number
  }
  daily: DailyActivity[]
  topUsers: TopUser[]
  topChannels: TopChannel[]
  members: {
    series: MemberPoint[]
    latest: MemberPoint | null
  }
}

export type PeriodDays = 7 | 30 | 90 | 'all'
