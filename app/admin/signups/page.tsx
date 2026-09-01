'use client'

import AdminShell from '@/components/admin/AdminShell'
import CollectionManager from '@/components/admin/CollectionManager'
import { COLLECTIONS } from '@/app/lib/sharedConstants'

export default function SignupsAdminPage() {
  return (
    <AdminShell title="Signup boards">
      <CollectionManager
        collection={COLLECTIONS.signupBoardConfigs}
        fields={[
          { key: 'id', label: 'ID (optional, leave blank to auto-create)' },
          { key: 'title', label: 'Title' },
          { key: 'channelId', label: 'Channel ID' },
          { key: 'description', label: 'Description', multiline: true },
        ]}
      />
    </AdminShell>
  )
}
