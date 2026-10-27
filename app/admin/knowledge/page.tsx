'use client'

import { useEffect, useState } from 'react'
import AdminShell from '@/components/admin/AdminShell'
import CollectionManager from '@/components/admin/CollectionManager'
import { COLLECTIONS } from '@/app/lib/sharedConstants'

export default function KnowledgeAdminPage() {
  // ?title= comes from "Create article" on a knowledge gap (/admin/onboarding).
  const [initialDraft, setInitialDraft] = useState<Record<string, string> | undefined>()
  useEffect(() => {
    const title = new URLSearchParams(window.location.search).get('title')
    if (title) setInitialDraft({ title })
  }, [])

  return (
    <AdminShell title="Bot knowledge">
      <CollectionManager
        collection={COLLECTIONS.botKnowledge}
        initialDraft={initialDraft}
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
