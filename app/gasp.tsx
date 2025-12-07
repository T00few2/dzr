'use client'
// Import GSAP and TextPlugin
import { gsap } from 'gsap';
import { TextPlugin } from 'gsap/dist/TextPlugin'; // Make sure to import from 'dist' directory
import { useRef, useEffect } from 'react';

import {
    Text,
  } from '@chakra-ui/react'

// Ensure TextPlugin is added to gsap
gsap.registerPlugin(TextPlugin);

// Component
export const DZR_slogan = () => {
    // Ref for the text element
    const textRef = useRef(null);
  
    // Animation function
    const animateText = () => {
        gsap.to(textRef.current, {
          duration: 4,
          delay: 0.5,
          color: 'grey',
          text: {
              value: "the pain in the peloton",
              rtl: false,
          },
          });
    };

    useEffect(() => {
        animateText();
      }, []); 
  
    return (
        <Text ref={textRef} color={'black'} maxW={'3xl'} as='cite' fontSize={{ base: 'l', sm: 'xl', md: '2xl' }}>
            -
        </Text>
    );
};

export const DZR_logo = () => {
    // Ref for the text element
    const textRef = useRef(null);
  
    // Animation function
    const animateText = () => {
        gsap.fromTo(textRef.current, 
          {
            opacity: 0,
            y: 30
          },
          {
            duration: 1.2,
            opacity: 1,
            y: 0,
            ease: 'power3.out',
            color: '#fffaf0' // floralwhite in hex
          }
        );    
    };

    useEffect(() => {
        animateText();
      }, []); 
  
    return (
        <Text 
          ref={textRef} 
          style={{ color: '#fffaf0' }}
          maxW={'5xl'} 
          fontSize={{ base: '5xl', sm: '5xl', md: '7xl' }} 
          fontWeight={900}
          textShadow='0 4px 20px rgba(173, 26, 45, 0.5)'
        >
            DANISH ZWIFT RACERS
        </Text>
    );
};