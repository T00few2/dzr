'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Box, IconButton, useBreakpointValue } from '@chakra-ui/react'
import { MdOutlineKeyboardArrowLeft, MdOutlineKeyboardArrowRight } from 'react-icons/md'

export default function SlideCarousel({ slides }: { slides: ReactNode[] }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [seen, setSeen] = useState<number[]>([0])
  const count = slides.length
  const current = count ? index % count : 0
  const top = useBreakpointValue({ base: '42%', md: '46%' })
  const side = useBreakpointValue({ base: '8px', md: '10px' })

  useEffect(() => {
    setSeen((values) => (values.includes(current) ? values : [...values, current]))
  }, [current])

  useEffect(() => {
    if (paused || count < 2) return
    const timer = window.setInterval(() => {
      setIndex((value) => (value + 1) % count)
    }, 5000)
    return () => window.clearInterval(timer)
  }, [paused, count, current])

  if (!count) return null
  const showAt = (next: number) => setIndex((next + count) % count)

  return (
    <Box position="relative" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <Box position="relative">
        {slides.map((slide, slideIndex) => {
          const active = slideIndex === current
          if (!active && !seen.includes(slideIndex)) return null
          return (
            <Box
              key={slideIndex}
              visibility={active ? 'visible' : 'hidden'}
              position={active ? 'relative' : 'absolute'}
              top={0}
              left={0}
              w="100%"
              pointerEvents={active ? 'auto' : 'none'}
              aria-hidden={!active}
            >
              {slide}
            </Box>
          )
        })}
      </Box>
      {count > 1 ? (
        <>
          <IconButton
            aria-label="left-arrow"
            size="md"
            variant="solid"
            colorScheme="whiteAlpha"
            borderColor="transparent"
            position="absolute"
            left={side}
            top={top}
            transform="translate(0%, -50%)"
            zIndex={2}
            onClick={() => showAt(current - 1)}
          >
            <MdOutlineKeyboardArrowLeft fontSize="30px" color="black" />
          </IconButton>
          <IconButton
            aria-label="right-arrow"
            size="md"
            variant="solid"
            colorScheme="whiteAlpha"
            borderColor="transparent"
            position="absolute"
            right={side}
            top={top}
            transform="translate(0%, -50%)"
            zIndex={2}
            onClick={() => showAt(current + 1)}
          >
            <MdOutlineKeyboardArrowRight fontSize="30px" color="black" />
          </IconButton>
          <Box as="ul" display="flex" justifyContent="center" gap="8px" mt={3} mb={1} p={0} listStyleType="none">
            {slides.map((_, dot) => (
              <Box as="li" key={dot}>
                <Box
                  as="button"
                  aria-label={`Show slide ${dot + 1}`}
                  w="12px"
                  h="12px"
                  rounded="full"
                  bg={dot === current ? 'white' : 'whiteAlpha.500'}
                  onClick={() => showAt(dot)}
                />
              </Box>
            ))}
          </Box>
        </>
      ) : null}
    </Box>
  )
}
