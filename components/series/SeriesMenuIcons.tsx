'use client'

import { Icon } from '@chakra-ui/react'
import { LiaMountainSolid } from 'react-icons/lia'
import { Im500Px } from 'react-icons/im'
import { AiOutlineAim } from 'react-icons/ai'
import { RiBoxingFill } from 'react-icons/ri'
import { MdCalendarMonth, MdFlashOn, MdNightlight, MdOutlineTimer, MdSpeed } from 'react-icons/md'
import { GiDevilMask, GiLaurels, GiMountainRoad, GiPodium, GiRoad } from 'react-icons/gi'
import {
  FaBicycle,
  FaBolt,
  FaCrown,
  FaFire,
  FaFlagCheckered,
  FaHeart,
  FaMedal,
  FaSnowflake,
  FaStar,
  FaSun,
  FaTrophy,
} from 'react-icons/fa6'
import type { IconType } from 'react-icons'
import { seriesMenuIconId, type SeriesMenuIconId } from '@/app/lib/seriesMenuIcons'

export const SERIES_MENU_ICONS: { id: SeriesMenuIconId; label: string; icon: IconType }[] = [
  { id: 'mountain', label: 'Mountain', icon: LiaMountainSolid },
  { id: 'climb', label: 'Climb', icon: GiMountainRoad },
  { id: 'road', label: 'Road', icon: GiRoad },
  { id: 'bike', label: 'Bike', icon: FaBicycle },
  { id: 'fifty', label: 'Fifty', icon: Im500Px },
  { id: 'glove', label: 'Glove', icon: RiBoxingFill },
  { id: 'target', label: 'Target', icon: AiOutlineAim },
  { id: 'timer', label: 'Timer', icon: MdOutlineTimer },
  { id: 'speed', label: 'Speed', icon: MdSpeed },
  { id: 'flash', label: 'Flash', icon: MdFlashOn },
  { id: 'flag', label: 'Flag', icon: FaFlagCheckered },
  { id: 'trophy', label: 'Trophy', icon: FaTrophy },
  { id: 'medal', label: 'Medal', icon: FaMedal },
  { id: 'podium', label: 'Podium', icon: GiPodium },
  { id: 'laurel', label: 'Laurel', icon: GiLaurels },
  { id: 'crown', label: 'Crown', icon: FaCrown },
  { id: 'star', label: 'Star', icon: FaStar },
  { id: 'fire', label: 'Fire', icon: FaFire },
  { id: 'bolt', label: 'Bolt', icon: FaBolt },
  { id: 'heart', label: 'Heart', icon: FaHeart },
  { id: 'mask', label: 'Mask', icon: GiDevilMask },
  { id: 'sun', label: 'Sun', icon: FaSun },
  { id: 'snow', label: 'Snow', icon: FaSnowflake },
  { id: 'night', label: 'Night', icon: MdNightlight },
  { id: 'calendar', label: 'Calendar', icon: MdCalendarMonth },
]

export function seriesMenuIcon(value: unknown): IconType {
  const id = seriesMenuIconId(value)
  return SERIES_MENU_ICONS.find((item) => item.id === id)?.icon || LiaMountainSolid
}

export function SeriesIconChoices({ value, onChange }: { value: string; onChange: (id: SeriesMenuIconId) => void }) {
  const selected = seriesMenuIconId(value)
  return (
    <>
      {SERIES_MENU_ICONS.map((item) => (
        <ButtonIcon key={item.id} item={item} selected={item.id === selected} onChange={onChange} />
      ))}
    </>
  )
}

function ButtonIcon({
  item,
  selected,
  onChange,
}: {
  item: (typeof SERIES_MENU_ICONS)[number]
  selected: boolean
  onChange: (id: SeriesMenuIconId) => void
}) {
  return (
    <button
      type="button"
      aria-label={item.label}
      aria-pressed={selected}
      onClick={() => onChange(item.id)}
      title={item.label}
      style={{
        width: 44,
        height: 44,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        border: selected ? '2px solid #E53E3E' : '1px solid #4A5568',
        background: selected ? '#E53E3E' : 'transparent',
        color: 'white',
        cursor: 'pointer',
      }}
    >
      <Icon as={item.icon} boxSize={5} />
    </button>
  )
}
