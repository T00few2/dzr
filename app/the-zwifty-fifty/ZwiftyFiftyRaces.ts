export class ZwiftyFiftyRacesTemplate {
  route: string = '';
  world: string = '';
  linkRoute: string = '';
  laps: string = '';
  length: string = '';
  hm: string = '';
  climbs: string[] = [];
  sprints: string[] = [];
  sprintLaps: string[] = [];
  bonus: string[] = [];
      
  constructor(initializer?: any) {
    if (!initializer) return;
    if (initializer.route) this.route = initializer.route;
    if (initializer.world) this.world = initializer.world;
    if (initializer.linkRoute) this.linkRoute = initializer.linkRoute;
    if (initializer.laps) this.laps = initializer.laps;
    if (initializer.length) this.length = initializer.length;
    if (initializer.hm) this.hm = initializer.hm;
    if (initializer.climbs) this.climbs = initializer.climbs;
    if (initializer.sprints) this.sprints = initializer.sprints;
    if (initializer.sprintLaps) this.sprintLaps = initializer.sprintLaps;
    if (initializer.bonus) this.bonus = initializer.bonus;
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
    climbs: ['Fox Hill', 'Box Hill'],
    sprints: ['Fox Hill','Box Hill'],
    sprintLaps: ['1','1'],
    bonus: ['3.0','2.0','1.0'],
  }),
  new ZwiftyFiftyRacesTemplate({
    route: 'The Muckle Yin',
    world: 'Scotland',
    linkRoute: 'https://zwiftinsider.com/route/the-muckle-yin/',
    laps: '2',
    length: '47',
    hm: '564',    
    climbs: ['Sgurr Summit North','Sgurr Summit South'],
    sprints: ['Sgurr Summit North','Sgurr Summit South'],
    sprintLaps: ['1,2','1,2'],
    bonus: ['1.5','1.0','0.5'],
  }),
  new ZwiftyFiftyRacesTemplate({
    route: '2022 Bambino Fondo',
    world: 'Watopia',
    linkRoute: 'https://zwiftinsider.com/route/2022-bambino-fondo/',
    laps: '1',
    length: '52.3',
    hm: '400',  
    climbs: ['Epic KOM Bypass','Volcano KOM'],
    sprints: ['Fuego Flats Long','Volcano Circuit Reverse'],
    sprintLaps: ['1','1'],
    bonus: ['3.0','2.0','1.0'],
  }),
];