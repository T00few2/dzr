'use client'

import { List, ListIcon, ListItem } from '@chakra-ui/react'
import type { IconType } from 'react-icons'
import { MdBackHand, MdPowerOff } from 'react-icons/md'
import { FaHeartCircleBolt, FaSuperpowers } from 'react-icons/fa6'
import { LuBike, LuTimer } from 'react-icons/lu'

export type SeriesRuleOption = {
  id: string
  label: string
  icon: IconType
  color: string
}

export const SERIES_RULES: SeriesRuleOption[] = [
  { id: 'category', label: 'Category Enforced', icon: MdBackHand, color: 'orange' },
  { id: 'power', label: 'Power Meter Enforced', icon: FaSuperpowers, color: 'green.500' },
  { id: 'heart', label: 'Heart Rate Monitor Enforced', icon: FaHeartCircleBolt, color: 'red.500' },
  { id: 'tt', label: 'No TT bikes Enforced', icon: LuBike, color: 'white' },
  { id: 'powerups', label: 'No PowerUps', icon: MdPowerOff, color: 'yellow' },
  { id: 'gap', label: 'Minimum 3 Seconds Time Gap (iTT excluded)', icon: LuTimer, color: 'white' },
]

export function ruleOption(label: string) {
  const wanted = label.trim().toLowerCase()
  return SERIES_RULES.find((rule) => rule.label.toLowerCase() === wanted) || null
}

export function orderedRules(selected: string[]) {
  const known = SERIES_RULES
    .filter((rule) => selected.some((item) => item.trim().toLowerCase() === rule.label.toLowerCase()))
    .map((rule) => rule.label)
  const extra = selected
    .map((item) => item.trim())
    .filter((item) => item && !ruleOption(item))
  return [...known, ...extra]
}

export function SeriesRulesList({ rules }: { rules: string[] }) {
  const shown = orderedRules(rules)
  if (!shown.length) return null
  return (
    <List spacing={3} color="white">
      {shown.map((label) => {
        const known = ruleOption(label)
        return (
          <ListItem key={label}>
            {known ? <ListIcon as={known.icon} color={known.color} fontSize="20px" /> : null}
            {label}
          </ListItem>
        )
      })}
    </List>
  )
}
