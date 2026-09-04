import { redirect } from 'next/navigation'

export default function StravaConnectedPage() {
  redirect('/members-zone/my-pages?tab=2&strava=connected')
}
