import Image from "next/image";
import { Inter } from "next/font/google";
import HeroSection from "@/components/HeroSection";
import Testimonials from "@/components/Footer";
import { ColorModeScript } from '@chakra-ui/react'

const inter = Inter({ subsets: ['latin']})

export default function Home() {
  return (
    <div style={{backgroundColor:'black'}}>
    <HeroSection />
    <Testimonials />
    </div>
  );
}
