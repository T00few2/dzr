export class ZwiftyFiftyRacesTemplate {
    date: string = '';
    racePass: string = '';
    linkZP:  string = '';
    world: string = '';
    linkRoute: string = '';
    laps: string = '';
    length: string = '';
    hm: string = '';
    route: string = '';
      
    constructor(initializer?: any) {
      if (!initializer) return;
      if (initializer.date) this.date = initializer.date;
      if (initializer.racePass) this.racePass = initializer.racePass;
      if (initializer.linkZP) this.linkZP = initializer.linkZP;
      if (initializer.world) this.world = initializer.world;
      if (initializer.linkRoute) this.linkRoute = initializer.linkRoute;
      if (initializer.laps) this.laps = initializer.laps;
      if (initializer.length) this.length = initializer.length;
      if (initializer.hm) this.hm = initializer.hm;
      if (initializer.route) this.route = initializer.route;
    }
  }