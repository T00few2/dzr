import { getSheetData } from "../../../services/google-sheets.action";
import { CalenderTemplate } from "./calendarTemplate";

// Function to fetch and map race calendar data
export async function fetchRaceCalendarData(sheetType: 'DZR After Party' | 'The Zwifty Fifty'): Promise<CalenderTemplate[]> {
  try {
    const response = await getSheetData();
    const data = sheetType === 'DZR After Party' ? response.APSdata : response.ZFdata;

    if (data) {
      return data.slice(1).map(row => new CalenderTemplate({
        date: row[0],
        route: row[1],
        raceID: row[2]
      }));
    }

    return [];
  } catch (error) {
    console.error(`Error fetching ${sheetType} data:`, error);
    return [];
  }
}
