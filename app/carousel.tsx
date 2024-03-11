'use client'

import React from 'react'
import { Box, IconButton, useBreakpointValue, Image } from '@chakra-ui/react'
// Here we have used react-icons package for the icons
import { BiLeftArrowAlt, BiRightArrowAlt } from 'react-icons/bi'
import { FaArrowRight } from "react-icons/fa";
import { MdOutlineKeyboardArrowRight, MdOutlineKeyboardArrowLeft } from "react-icons/md";
// And react-slick as our Carousel Lib
import Slider from 'react-slick'


// Settings for the slider
const settings = {
  dots: true,
  arrows: false,
  fade: true,
  infinite: true,
  autoplay: true,
  speed: 500,
  autoplaySpeed: 5000,
  slidesToShow: 1,
  slidesToScroll: 1,
}

interface ImagesProps {
    cards: string[];
  }

export default function Carousel({cards}: ImagesProps) {
  // As we have used custom buttons, we need a reference variable to
  // change the state
  const [slider, setSlider] = React.useState<Slider | null>(null)

  // These are the breakpoints which changes the position of the
  // buttons as the screen size changes
  const top = useBreakpointValue({ base: '90%', md: '50%' })
  const side = useBreakpointValue({ base: '30%', md: '10px' })

  // These are the images used in the slide


  return (
    <Box position={'relative'} overflow={'hidden'}>
      {/* CSS files for react-slick */}
      <link
        rel="stylesheet"
        type="text/css"
        href="https://cdnjs.cloudflare.com/ajax/libs/slick-carousel/1.6.0/slick.min.css"
      />
      <link
        rel="stylesheet"
        type="text/css"
        href="https://cdnjs.cloudflare.com/ajax/libs/slick-carousel/1.6.0/slick-theme.min.css"
      />
      {/* Left Icon */}
      <IconButton
        aria-label="left-arrow"
        size='md'
        variant={'solid'}
        colorScheme="whiteAlpha"
        borderColor={'transparent'}
        position="absolute"
        left={side}
        top={top}
        transform={'translate(0%, -50%)'}
        zIndex={2}
        onClick={() => slider?.slickNext()}>
        <MdOutlineKeyboardArrowLeft fontSize={'30px'} color='black'/>
      </IconButton>
      {/* Right Icon */}
      <IconButton
        aria-label="right-arrow"
        size='md'
        variant={'solid'}
        colorScheme="whiteAlpha"
        borderColor={'transparent'}
        
        position="absolute"
        right={side}
        top={top}
        transform={'translate(0%, -50%)'}
        zIndex={2}
        onClick={() => slider?.slickNext()}>
        <MdOutlineKeyboardArrowRight fontSize={'30px'} color='black'/>
      </IconButton>
      {/* Slider */}
      <Slider {...settings} ref={(slider) => setSlider(slider)}>
        {cards.map((url, index) => (
          <Image src={url} key = {index}></Image>

        ))}
      </Slider>
    </Box>
  )
}