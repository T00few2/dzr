export class AfterPartyRacesTemplate {
    route: string = '';
    world: string = '';
    laps: string = '';
    distance: string = '';
    elevation: string = '';
    finish: string = '';
    linkRoute: string = '';
        
    constructor(initializer?: any) {
      if (!initializer) return;
      if (initializer.route) this.route = initializer.route;
      if (initializer.world) this.world = initializer.world;
      if (initializer.laps) this.laps = initializer.laps;
      if (initializer.distance) this.distance = initializer.distance;
      if (initializer.elevation) this.elevation = initializer.elevation;
      if (initializer.finish) this.finish = initializer.finish;
      if (initializer.linkRoute) this.linkRoute = initializer.linkRoute;
    }
}
  
export const AfterPartyRacesData = [
    new AfterPartyRacesTemplate({
      route: 'Roule Ma Poule',
      world: 'France',
      laps: '1',
      distance: '26.1',
      elevation: '262',
      finish: 'Banner on Petit KOM Reverse',
      linkRoute: 'https://zwiftinsider.com/route/roule-ma-poule/',
    }),
    new AfterPartyRacesTemplate({
      route: 'Libby Hill After Party+',
      world: 'Richmond',
      laps: '1+',
      distance: '36.767',
      elevation: '166',
      finish: 'Banner second time on Governor St. Climb',
      linkRoute: 'https://zwiftinsider.com/route/libby-hill-after-party/',
    }),
];