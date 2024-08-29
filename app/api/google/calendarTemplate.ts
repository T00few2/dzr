import { AfterPartyRacesTemplate } from '@/app/dzr-after-party/AfterPartyRaces';
import { ZwiftyFiftyRacesTemplate } from '@/app/the-zwifty-fifty/ZwiftyFiftyRaces';

export class CalenderTemplate {
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

export function apsInfo(race: CalenderTemplate, afterPartyRaceData: AfterPartyRacesTemplate) {
    
        const raceData = {
        ...race,
        raceSeries: "DZR After Party",
        world: afterPartyRaceData.world,
        laps: afterPartyRaceData.laps,
        distance: afterPartyRaceData.distance,
        elevation: afterPartyRaceData.elevation,
        finish: afterPartyRaceData.finish,
        linkRoute: afterPartyRaceData.linkRoute,
        climbs: [''],
        sprints: [''],
        sprintLaps: [''],
        bonus: [''],
        }

        return raceData
}

export function zfInfo(race: CalenderTemplate, zwiftyFiftyRaceData: ZwiftyFiftyRacesTemplate) {
    
    const raceData = {
        ...race,
        raceSeries: "The Zwifty Fifty",
        world: zwiftyFiftyRaceData.world,
        laps: zwiftyFiftyRaceData.laps,
        distance: zwiftyFiftyRaceData.length,
        elevation: zwiftyFiftyRaceData.hm,
        finish: '',
        linkRoute: zwiftyFiftyRaceData.linkRoute,
        climbs: zwiftyFiftyRaceData.climbs,
        sprints: zwiftyFiftyRaceData.sprints,
        sprintLaps: zwiftyFiftyRaceData.sprintLaps,
        bonus: zwiftyFiftyRaceData.bonus,
        }

    return raceData
}
  