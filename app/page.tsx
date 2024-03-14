import Image from "next/image";
import { Inter } from "next/font/google";
import HeroSection from "@/components/HeroSection";
import Features from "@/components/Features";
//import GoogleSheetsEmbed from "@/components/GoogleSheet";

import { ColorModeScript } from '@chakra-ui/react'


const inter = Inter({ subsets: ['latin']})

export default function Home() {
  return (
    <div style={{backgroundColor:'black'}}>
    <HeroSection />
    <Features />
    
    </div>
  );
}

// <GoogleSheetsEmbed spreadsheetId="YOUR_SPREADSHEET_ID" />
