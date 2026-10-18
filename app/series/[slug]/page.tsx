import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { publicSeries } from '@/app/lib/eventSeries'
import SeriesView, { type SeriesPageData } from './SeriesView'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const series = await publicSeries(params.slug).catch(() => null)
  if (!series) return { title: 'Series' }
  return {
    title: series.name,
    description: series.intro || series.timeLabel,
    openGraph: {
      title: series.name,
      description: series.intro || series.timeLabel,
      images: series.logoUrl ? [{ url: series.logoUrl }] : undefined,
    },
  }
}

export default async function SeriesPage({ params }: { params: { slug: string } }) {
  const series = await publicSeries(params.slug).catch(() => null)
  if (!series) notFound()
  const page: SeriesPageData = {
    slug: series.slug,
    name: series.name,
    intro: series.intro,
    timeLabel: series.timeLabel,
    kind: series.kind,
    logoUrl: series.logoUrl,
    rules: series.rules,
    pointsNote: series.pointsNote,
    pointsRows: series.pointsRows,
    leagueUrl: series.leagueUrl,
    schedule: series.schedule,
  }
  return <SeriesView series={page} />
}
