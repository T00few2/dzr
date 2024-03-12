export class AfterPartyCalenderTemplate {
    date: string = '';
    route: string = '';
    raceID: string = '';
  
    constructor(initializer?: any) {
      if (!initializer) return;
      if (initializer.date) this.date = initializer.date;
      if (initializer.route) this.route = initializer.route;
      if (initializer.raceID) this.raceID = initializer.raceID;
    }
  }
  
export const AfterPartyCalender = [
    new AfterPartyCalenderTemplate({
      date: "Thursday March 14",
      route: "Roule Ma Poule",
      raceID: "4269511",
    }),
];  