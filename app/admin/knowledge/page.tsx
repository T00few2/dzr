'use client'

import AdminShell from '@/components/admin/AdminShell'
import CollectionManager from '@/components/admin/CollectionManager'
import { COLLECTIONS } from '@/app/lib/sharedConstants'

export default function KnowledgeAdminPage() {
  return (
    <AdminShell title="Bot knowledge">
      <CollectionManager
        collection={COLLECTIONS.botKnowledge}
        fields={[
          { key: 'id', label: 'Key (document id)' },
          { key: 'title', label: 'Title' },
          { key: 'content', label: 'Content', multiline: true },
          { key: 'tags', label: 'Tags (comma-separated)' },
        ]}
      />
    </AdminShell>
  )
}
