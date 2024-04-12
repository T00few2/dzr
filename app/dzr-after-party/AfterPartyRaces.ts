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
    new AfterPartyRacesTemplate({
      route: 'Sand And Sequoias',
      world: 'Watopia',
      laps: '1+',
      distance: '35.285',
      elevation: '297',
      finish: 'Blue banner second time on Titans Grove KOM',
      linkRoute: 'https://zwiftinsider.com/route/sand-and-sequoias/',
    }),
    new AfterPartyRacesTemplate({
      route: 'The Muckle Yin',
      world: 'Scotland',
      laps: '1+',
      distance: '33.426',
      elevation: '409',
      finish: 'Blue banner second time on Sgurr Summit North',
      linkRoute: 'https://zwiftinsider.com/route/the-muckle-yin/',
    }),
    new AfterPartyRacesTemplate({
      route: '2015 UCI Worlds Course',
      world: 'Richmond',
      laps: '2',
      distance: '33',
      elevation: '307',
      finish: 'Banner second time on Governor St. Climb',
      linkRoute: 'https://zwiftinsider.com/route/richmond-uci-worlds/',
    }),
    new AfterPartyRacesTemplate({
      route: 'Out And Back Again',
      world: 'Watopia',
      laps: '<1',
      distance: '36.47',
      elevation: '300',
      finish: 'Blue banner on Zwift KOM reverse',
      linkRoute: 'https://zwiftinsider.com/route/out-and-back-again/',
    }),
    new AfterPartyRacesTemplate({
      route: 'Temples and Towers',
      world: 'Makuri Islands',
      laps: '1+',
      distance: '37.882',
      elevation: '400',
      finish: 'Blue banner second time on Rooftop KOM',
      linkRoute: 'https://zwiftinsider.com/route/temples-and-towers/',
    }),
    new AfterPartyRacesTemplate({
      route: 'Country To Coastal',
      world: 'Makuri Islands',
      laps: '1+',
      distance: '35.194',
      elevation: '330',
      finish: 'Blue banner second time on Village Sprint',
      linkRoute: 'https://zwiftinsider.com/route/country-to-coastal/',
    }),
    new AfterPartyRacesTemplate({
      route: 'Innsbruckring',
      world: 'Innsbruck',
      laps: '3+',
      distance: '31.83',
      elevation: '287',
      finish: 'Blue banner fourth time on Legsnapper',
      linkRoute: 'https://zwiftinsider.com/route/innsbruckring/',
    }),
    new AfterPartyRacesTemplate({
      route: '2019 UCI Worlds',
      world: 'Yorkshire',
      laps: '2+',
      distance: '36.575',
      elevation: '673',
      finish: 'Blue banner third time on Yorkshire KOM',
      linkRoute: 'https://zwiftinsider.com/route/2019-uci-worlds-harrogate-circuit/',
    }),
    new AfterPartyRacesTemplate({
      route: 'Fine And Sandy',
      world: 'Makuri Islands',
      laps: '3+',
      distance: '34.013',
      elevation: '261',
      finish: 'Blue banner seventh time on top of Mech Isle Climb',
      linkRoute: 'https://zwiftinsider.com/route/fine-and-sandy/',
    }),
];