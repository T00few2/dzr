"use client"
import { useState, useEffect } from "react";
import { getSheetData } from "../../../services/google-sheets.action";
import { CalenderTemplate } from "./calendarTemplate";


export function useRaceCalendarAPS() {
  const [sheetData, setSheetData] = useState<any[][] | null>(null); // Initialize state to handle array of arrays or null
  const [calendarDataAPS, setCalendarDataAPS] = useState<CalenderTemplate[]>([]); // State to hold instances of AfterPartyCalenderTemplate

  const fetchData = async () => {
    try {
      
        const response = await getSheetData();
        setSheetData(response.APSdata || null);
        
        // Map through sheetData and create instances of AfterPartyCalenderTemplate
        if (response.APSdata) {
          const mappedData = response.APSdata.slice(1).map(row => new CalenderTemplate({
            date: row[0], // Assuming date is in the first column
            route: row[1], // Assuming route is in the second column
            raceID: row[2]  // Assuming raceID is in the third column
          }));
          setCalendarDataAPS(mappedData);
        }
      

    } catch (error) {
      console.error("Error fetching sheet data:", error);
      setSheetData(null); // Handle error by resetting data
    }
  };

  useEffect(() => {
    // Fetch data immediately when the component mounts
    fetchData();

    // Set up an interval to fetch data every 10 seconds
    const interval = setInterval(fetchData, 10000); // 10000ms = 10s

    // Clean up the interval when the component unmounts
    return () => clearInterval(interval);
  }, []); // Empty dependency array ensures this runs only once after the initial render

  
  return calendarDataAPS;
}

export function useRaceCalendarZF() {
  const [sheetData, setSheetData] = useState<any[][] | null>(null); // Initialize state to handle array of arrays or null
  const [calendarDataZF, setCalendarDataZF] = useState<CalenderTemplate[]>([]); 

  const fetchData = async () => {
    try {
        const response = await getSheetData();
        setSheetData(response.ZFdata || null);        
        
        // Map through sheetData and create instances of AfterPartyCalenderTemplate
        if (response.ZFdata) {
          const mappedData = response.ZFdata.slice(1).map(row => new CalenderTemplate({
            date: row[0], // Assuming date is in the first column
            route: row[1], // Assuming route is in the second column
            raceID: row[2]  // Assuming raceID is in the third column
          }));
          setCalendarDataZF(mappedData);
      }

    } catch (error) {
      console.error("Error fetching sheet data:", error);
      setSheetData(null); // Handle error by resetting data
    }
  };

  useEffect(() => {
    // Fetch data immediately when the component mounts
    fetchData();

    // Set up an interval to fetch data every 10 seconds
    const interval = setInterval(fetchData, 10000); // 10000ms = 10s

    // Clean up the interval when the component unmounts
    return () => clearInterval(interval);
  }, []); // Empty dependency array ensures this runs only once after the initial render

  
  return calendarDataZF;
}