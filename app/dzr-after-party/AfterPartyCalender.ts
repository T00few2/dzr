export class AfterPartyCalenderTemplate {
  date: string = '';
  postDate: string = '';
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
    postDate: "Roule Ma Poule",
    route: "4269511",
    raceID: "",
  }),
  new AfterPartyCalenderTemplate({
    date: "Thursday March 21",
    postDate: "Libby Hill After Party+",
    route: "4285111",
    raceID: "",
  }),
  new AfterPartyCalenderTemplate({
    date: "Thursday March 28",
    postDate: "Tempus Frugit",
    route: "",
    raceID: "",
  })
];
