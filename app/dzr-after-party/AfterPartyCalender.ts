export class AfterPartyCalenderTemplate {
  date: string = '';
  postDate: Date = '';
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
    postDate: "08-03-2024",
    route: "Roule Ma Poule",
    raceID: "4269511",
  }),
  new AfterPartyCalenderTemplate({
    date: "Thursday March 21",
    postDate: "15-03-2024",
    route: "Libby Hill After Party+",
    raceID: "4285111",
  }),
  new AfterPartyCalenderTemplate({
    date: "Thursday March 28",
    postDate: "22-03-2024",
    route: "Tempus Frugit",
    raceID: "",
  })
];
