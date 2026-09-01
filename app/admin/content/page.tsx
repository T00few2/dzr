'use client'

import AdminShell from '@/components/admin/AdminShell'
import CollectionManager from '@/components/admin/CollectionManager'
import { Tabs, TabList, TabPanels, Tab, TabPanel } from '@chakra-ui/react'
import { COLLECTIONS } from '@/app/lib/sharedConstants'

export default function ContentAdminPage() {
  return (
    <AdminShell title="Content">
      <Tabs colorScheme="red">
        <TabList>
          <Tab>Welcome</Tab>
          <Tab>Scheduled</Tab>
          <Tab>Role messages</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <CollectionManager
              collection={COLLECTIONS.welcomeMessages}
              fields={[
                { key: 'title', label: 'Title' },
                { key: 'content', label: 'Content', multiline: true },
                { key: 'active', label: 'Active (true/false)' },
              ]}
            />
          </TabPanel>
          <TabPanel>
            <CollectionManager
              collection={COLLECTIONS.scheduledMessages}
              fields={[
                { key: 'title', label: 'Title' },
                { key: 'content', label: 'Content', multiline: true },
                { key: 'channel_id', label: 'Channel ID' },
                { key: 'active', label: 'Active (true/false)' },
              ]}
            />
          </TabPanel>
          <TabPanel>
            <CollectionManager
              collection={COLLECTIONS.roleMessages}
              fields={[
                { key: 'title', label: 'Title' },
                { key: 'content', label: 'Content', multiline: true },
                { key: 'role_id', label: 'Role ID' },
                { key: 'channel_id', label: 'Channel ID' },
                { key: 'active', label: 'Active (true/false)' },
              ]}
            />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </AdminShell>
  )
}
