import { redirect } from 'next/navigation'

export default function GrowthAdminRedirect() {
  redirect('/admin/stats')
}
