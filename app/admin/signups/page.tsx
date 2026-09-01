'use client'

import AdminShell from '@/components/admin/AdminShell'
import CollectionManager from '@/components/admin/CollectionManager'
import LiveSignups from '@/components/admin/signups/LiveSignups'
import { Tabs, TabList, TabPanels, Tab, TabPanel } from '@chakra-ui/react'
import { COLLECTIONS } from '@/app/lib/sharedConstants'

export default function SignupsAdminPage() {
  return (
    <AdminShell title="Signup boards">
      <Tabs colorScheme="red">
        <TabList>
          <Tab>Live signups</Tab>
          <Tab>Board templates</Tab>
        </TabList>
        <TabPanels>
          <TabPanel px={0}>
            <LiveSignups />
          </TabPanel>
          <TabPanel px={0}>
            <CollectionManager
              collection={COLLECTIONS.signupBoardConfigs}
              fields={[
                { key: 'id', label: 'ID (optional, leave blank to auto-create)' },
                { key: 'title', label: 'Title' },
                { key: 'channelId', label: 'Channel ID' },
                { key: 'description', label: 'Description', multiline: true },
              ]}
            />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </AdminShell>
  )
}
