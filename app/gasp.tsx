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
        gsap.to(textRef.current, {
          duration: 5,
          delay: 0,
          
          textShadow: '0 0 10px  rgba(173, 26, 45, 1),0 0 20px  rgba(173, 26, 45, 1),0 0 30px  rgba(173, 26, 45, 1),0 0 40px  rgba(173, 26, 45, 1),0 0 60px  rgba(173, 26, 45, 1),0 0 80px  rgba(173, 26, 45, 1)',
          zIndex : -1,
          });    
    };

    useEffect(() => {
        animateText();
      }, []); 
  
    return (
        <Text ref={textRef} color='floralwhite' maxW={'5xl'} fontSize={{ base: '5xl', sm: '5xl', md: '7xl' }} fontWeight={900} >
            DANISH ZWIFT RACERS
        </Text>
    );
};