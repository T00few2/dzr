"use client"

import { useState, useEffect } from "react";
import { getSheetData } from "../../../services/google-sheets.action";


export class AfterPartyCalenderTemplate {
  date: string = ''; // Store the formatted date as a string
  route: string = '';
  raceID: string = '';

  constructor(initializer?: any) {
    if (!initializer) return;
    
    // Convert the date to a Date object and format it
    if (initializer.date) {
      const dateObj = new Date(initializer.date);
      this.date = this.formatDate(dateObj);
    }

    if (initializer.route) this.route = initializer.route;
    if (initializer.raceID) this.raceID = initializer.raceID;
  }

  // Method to format the date
  private formatDate(date: Date): string {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    };
    return new Intl.DateTimeFormat('en-US', options).format(date).replace(',', '')
  }
}

export function useRaceCalendar() {
  const [sheetData, setSheetData] = useState<any[][] | null>(null); // Initialize state to handle array of arrays or null
  const [calendarData, setCalendarData] = useState<AfterPartyCalenderTemplate[]>([]); // State to hold instances of AfterPartyCalenderTemplate

  const fetchData = async () => {
    try {
      const response = await getSheetData();
      setSheetData(response.APSdata || null);
      
      // Map through sheetData and create instances of AfterPartyCalenderTemplate
      if (response.APSdata) {
        const mappedData = response.APSdata.slice(1).map(row => new AfterPartyCalenderTemplate({
          date: row[0], // Assuming date is in the first column
          route: row[1], // Assuming route is in the second column
          raceID: row[2]  // Assuming raceID is in the third column
        }));
        setCalendarData(mappedData);
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

  
  return calendarData;
}
