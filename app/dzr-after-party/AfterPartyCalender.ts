export class AfterPartyCalenderTemplate {
  date: string = '';
  postDate: Date = new Date();
  route: string = '';
  raceID: string = '';

  constructor(initializer?: any) {
    if (!initializer) return;
    if (initializer.date) this.date = initializer.date;
    if (initializer.postDate) this.postDate = initializer.postDate;
    if (initializer.route) this.route = initializer.route;
    if (initializer.raceID) this.raceID = initializer.raceID;
  }
}

export const AfterPartyCalender = [
  new AfterPartyCalenderTemplate({
    date: "Thursday March 14",
    postDate: "03-08-2024",
    route: "Roule Ma Poule",
    raceID: "4269511",
  }),
  new AfterPartyCalenderTemplate({
    date: "Thursday March 21",
    postDate: "03-15-2024",
    route: "Libby Hill After Party+",
    raceID: "4285111",
  }),
  new AfterPartyCalenderTemplate({
    date: "Thursday March 28",
    postDate: "03-22-2024",
    route: "Sand And Sequoias",
    raceID: "4299191",
  }),
  new AfterPartyCalenderTemplate({
    date: "Thursday April 4",
    postDate: "03-29-2024",
    route: "Country To Coastal",
    raceID: "4315021",
  }),
  new AfterPartyCalenderTemplate({
    date: "Thursday April 11",
    postDate: "04-06-2024",
    route: "2019 UCI Worlds",
    raceID: "4327975",
  }),
  new AfterPartyCalenderTemplate({
    date: "Thursday April 18",
    postDate: "04-12-2024",
    route: "Fine And Sandy",
    raceID: "4340253",
  }),
  new AfterPartyCalenderTemplate({
    date: "Thursday April 25",
    postDate: "04-19-2024",
    route: "Volcano Climb",
    raceID: "4350694",
  }),
  new AfterPartyCalenderTemplate({
    date: "Thursday May 2",
    postDate: "04-26-2024",
    route: "Big Foot Hills",
    raceID: "4361282",
  }),
  new AfterPartyCalenderTemplate({
    date: "Thursday May 9",
    postDate: "05-05-2024",
    route: "Rolling Highlands",
    raceID: "4372216",
  }),
  new AfterPartyCalenderTemplate({
    date: "Thursday May 16",
    postDate: "05-11-2024",
    route: "Downtown Titans",
    raceID: "4380526",
  }),
  new AfterPartyCalenderTemplate({
    date: "Thursday May 23",
    postDate: "05-18-2024",
    route: "New York KOM After Party",
    raceID: "4387785",
  }),
  new AfterPartyCalenderTemplate({
    date: "Thursday May 30",
    postDate: "05-25-2024",
    route: "Figure 8 Reverse",
    raceID: "4395039",
  }),
  new AfterPartyCalenderTemplate({
    date: "Thursday June 6",
    postDate: "06-01-2024",
    route: "Innsbruckring",
    raceID: "4403425",
  }),
  new AfterPartyCalenderTemplate({
    date: "Thursday June 13",
    postDate: "06-08-2024",
    route: "Innsbruckring",
    raceID: "4410634",
  }),
  new AfterPartyCalenderTemplate({
    date: "Thursday June 20",
    postDate: "06-14-2024",
    route: "Coastal Crown Loop",
    raceID: "4417558",
  }),
  new AfterPartyCalenderTemplate({
    date: "Thursday June 27",
    postDate: "06-22-2024",
    route: "Glyph Heights",
    raceID: "4424598",
  }),
  new AfterPartyCalenderTemplate({
    date: "Thursday July 4",
    postDate: "06-28-2024",
    route: "Roule Ma Poule",
    raceID: "4432975",
  }),
  new AfterPartyCalenderTemplate({
    date: "Thursday July 11",
    postDate: "07-08-2024",
    route: "Libby Hill After Party+",
    raceID: "4439678",
  }),
  new AfterPartyCalenderTemplate({
    date: "Thursday July 18",
    postDate: "07-13-2024",
    route: "Country To Coastal",
    raceID: "4446187",
  }),
  new AfterPartyCalenderTemplate({
    date: "Thursday July 25",
    postDate: "07-19-2024",
    route: "Itza Party",
    raceID: "4453026",
  })
];
