"use client"
import { useState, useEffect } from "react";
import { CalenderTemplate } from "./calendarTemplate";

function publishedRow(row: { date?: string; route?: string; raceID?: string }) {
  const item = new CalenderTemplate()
  item.date = String(row.date || '')
  item.route = String(row.route || '')
  item.raceID = String(row.raceID || '')
  return item
}

async function loadPublished(series: 'after-party' | 'zwifty-fifty') {
  const res = await fetch(`/api/series/${series}`, { cache: 'no-store' })
  if (!res.ok) return []
  const body = await res.json()
  return Array.isArray(body.races) ? body.races.map(publishedRow) : []
}

export function useRaceCalendarAPS() {
  const [calendarDataAPS, setCalendarDataAPS] = useState<CalenderTemplate[]>([]);
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
  const [calendarDataZF, setCalendarDataZF] = useState<CalenderTemplate[]>([]);
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