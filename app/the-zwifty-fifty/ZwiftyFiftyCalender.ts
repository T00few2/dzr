export class ZwiftyFiftyCalenderTemplate {
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
  
  export const ZwiftyFiftyCalender = [
    new ZwiftyFiftyCalenderTemplate({
      date: 'Sunday March 10',
      route: 'The London Pretzel',
      raceID: '4258717',
    }),
    new ZwiftyFiftyCalenderTemplate({
        date: 'Sunday March 17',
        route: '2022 Bambino Fondo',
        raceID: '#',
      }),
  ];