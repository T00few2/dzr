export class ZwiftyFiftyRacesTemplate {
  route: string = '';
  world: string = '';
  linkRoute: string = '';
  laps: string = '';
  length: string = '';
  hm: string = '';
      
  constructor(initializer?: any) {
    if (!initializer) return;
    if (initializer.route) this.route = initializer.route;
    if (initializer.world) this.world = initializer.world;
    if (initializer.linkRoute) this.linkRoute = initializer.linkRoute;
    if (initializer.laps) this.laps = initializer.laps;
    if (initializer.length) this.length = initializer.length;
    if (initializer.hm) this.hm = initializer.hm;
  }
}

export const ZwiftyFiftyRacesData = [
  new ZwiftyFiftyRacesTemplate({
    route: 'The London Pretzel',
    world: 'London',
    linkRoute: 'https://zwiftinsider.com/route/the-london-pretzel/',
    laps: '1',
    length: '55.6',
    hm: '531',    
  }),
  new ZwiftyFiftyRacesTemplate({
    route: 'The Muckle Yin',
    world: 'Scotland',
    linkRoute: 'https://zwiftinsider.com/route/the-muckle-yin/',
    laps: '2',
    length: '55.6',
    hm: '531',    
  }),
  new ZwiftyFiftyRacesTemplate({
    route: '2022 Bambino Fondo',
    world: 'WatopiA',
    linkRoute: 'https://zwiftinsider.com/route/2022-bambino-fondo/',
    laps: '1',
    length: '52.3',
    hm: '400',    
  }),
];