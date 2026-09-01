'use client'

import AdminShell from '@/components/admin/AdminShell'
import { SimpleGrid, Box, Heading, Text, Button } from '@chakra-ui/react'
import NextLink from 'next/link'

const CARDS = [
  { href: '/admin/membership', title: 'Membership', body: 'Settings, payments, CSV export, role reconcile' },
  { href: '/admin/members', title: 'Members', body: 'Discord members and Zwift ID linking' },
  { href: '/admin/stats', title: 'Discord stats', body: 'Recent server activity from Firestore' },
  { href: '/admin/content', title: 'Content', body: 'Welcome, scheduled, and role messages' },
  { href: '/admin/roles', title: 'Role panels', body: 'selfRoles panels used by the Discord bot' },
  { href: '/admin/signups', title: 'Signup boards', body: 'signup_board_configs' },
  { href: '/admin/knowledge', title: 'Bot knowledge', body: 'Snippets for the Discord AI assistant' },
  { href: '/admin/outreach', title: 'Member outreach', body: 'DM members from a template' },
  { href: '/admin/growth', title: 'Club growth', body: 'Companion club roster counts and refresh' },
]

export default function AdminHome() {
  return (
    <AdminShell title="Admin">
      <Text color="gray.300" mb={6}>
        Club admin tools on the member site. Each card is a screen that already lives here.
      </Text>
      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
        {CARDS.map((c) => (
          <Box key={c.href} borderWidth="1px" borderColor="gray.700" rounded="md" p={5}>
            <Heading size="sm" mb={2}>{c.title}</Heading>
            <Text color="gray.400" mb={4} minH="48px">{c.body}</Text>
            <Button as={NextLink} href={c.href} size="sm" colorScheme="red">Open</Button>
          </Box>
        ))}
      </SimpleGrid>
    </AdminShell>
  )
}
