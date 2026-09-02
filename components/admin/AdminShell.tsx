'use client'

import { Box, Button, Container, Flex, Heading, HStack, Link } from '@chakra-ui/react'
import { Global } from '@emotion/react'
import NextLink from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'

const NAV = [
  { href: '/admin', label: 'Home' },
  { href: '/admin/membership', label: 'Membership' },
  { href: '/admin/members', label: 'Members' },
  { href: '/admin/stats', label: 'Stats' },
  { href: '/admin/content', label: 'Content' },
  { href: '/admin/roles', label: 'Roles' },
  { href: '/admin/signups', label: 'Signups' },
  { href: '/admin/knowledge', label: 'Knowledge' },
  { href: '/admin/outreach', label: 'Outreach' },
  { href: '/admin/growth', label: 'Growth' },
]

export default function AdminShell({ title, children }: { title: string; children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <Box minH="100vh" bg="black" color="white" pt={{ base: 24, md: 28 }} pb={16}>
      <Global
        styles={`
          select option {
            color: #171923;
            background-color: #fff;
          }
        `}
      />
      <Container maxW="7xl">
        <Heading size="lg" mb={4}>{title}</Heading>
        <Flex gap={2} wrap="wrap" mb={8}>
          {NAV.map((item) => (
            <Button
              key={item.href}
              as={NextLink}
              href={item.href}
              size="sm"
              variant={pathname === item.href ? 'solid' : 'outline'}
              colorScheme="red"
            >
              {item.label}
            </Button>
          ))}
        </Flex>
        {children}
        <HStack mt={10} spacing={4} fontSize="sm" color="gray.400">
          <Link as={NextLink} href="/members-zone">Members zone</Link>
        </HStack>
      </Container>
    </Box>
  )
}
