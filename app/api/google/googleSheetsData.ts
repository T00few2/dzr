"use client"
import { useState, useEffect } from "react";
import type { CatalogRoute } from "@/app/lib/catalogRoute";

export type PublishedRace = {
  date: string
  route: string
  raceID: string
  catalog: CatalogRoute | null
}

function publishedRow(row: { date?: string; route?: string; raceID?: string; catalog?: CatalogRoute | null }): PublishedRace {
  return {
    date: String(row.date || ''),
    route: String(row.route || ''),
    raceID: String(row.raceID || ''),
    catalog: row.catalog || null,
  }
}

async function loadPublished(series: 'after-party' | 'zwifty-fifty') {
  const res = await fetch(`/api/series/${series}`, { cache: 'no-store' })
  if (!res.ok) return []
  const body = await res.json()
  return Array.isArray(body.races) ? body.races.map(publishedRow) : []
}

export function useRaceCalendarAPS() {
  const [calendarDataAPS, setCalendarDataAPS] = useState<PublishedRace[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const rows = await loadPublished('after-party')
        if (!cancelled) setCalendarDataAPS(rows)
      } catch (error) {
        console.error("Error fetching After Party schedule:", error);
        if (!cancelled) setCalendarDataAPS([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, []);

  return { calendarDataAPS, loading };
}

export function useRaceCalendarZF() {
  const [calendarDataZF, setCalendarDataZF] = useState<PublishedRace[]>([]);
  const [loadingZF, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const rows = await loadPublished('zwifty-fifty')
        if (!cancelled) setCalendarDataZF(rows)
      } catch (error) {
        console.error("Error fetching Zwifty Fifty schedule:", error);
        if (!cancelled) setCalendarDataZF([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, []);

  return { calendarDataZF, loadingZF };
}