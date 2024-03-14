import Image from "next/image";
import { Inter } from "next/font/google";
import HeroSection from "@/components/HeroSection";
import Features from "@/components/Features";
import GoogleCalendarEmbed from "@/components/GoogleCalendar";

import { ColorModeScript } from '@chakra-ui/react'

import Meta from '../components/Meta';


const inter = Inter({ subsets: ['latin']})

export default function Home() {
  return (
    <>
    <Meta
    title="DZR"
    description="Danish Zwift Racers"
    frontPageImage="/DZR_logo.svg"
    />
    <div style={{backgroundColor:'black'}}>
    <HeroSection />
    <Features />
    </div>
    </>
  );
}


