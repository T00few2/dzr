export class InTheZone2CalenderTemplate {
    date: string = '';
    postDate: Date = new Date();
    workout: string = '';
    duration: string = '';
    stressPoints: string = '';
    eventID1: string = '';
    eventID2: string = '';
  
    constructor(initializer?: any) {
      if (!initializer) return;
      if (initializer.date) this.date = initializer.date;
      if (initializer.postDate) this.postDate = initializer.postDate;
      if (initializer.workout) this.workout = initializer.workout;
      if (initializer.duration) this.duration = initializer.duration;
      if (initializer.stressPoints) this.stressPoints = initializer.stressPoints;
      if (initializer.eventID1) this.eventID1 = initializer.eventID1;
      if (initializer.eventID2) this.eventID2 = initializer.eventID2;
    }
  }
  
  export const InTheZone2Calender = [
    new InTheZone2CalenderTemplate({
      date: "Saturday April 6",
      postDate: "03-26-2024",
      workout: "gravel-grinder/week-9-building-base",
      duration: '2h',
      stressPoints: '101',
      eventID1: "4307240",
      eventID2: "4307242",
    }),
    new InTheZone2CalenderTemplate({
      date: "Saturday April 13",
      postDate: "04-08-2024",
      workout: "In The Zone 2 #1",
      duration: '2h',
      stressPoints: '95',
      eventID1: "4330782",
      eventID2: "4330876",
    }),
    new InTheZone2CalenderTemplate({
      date: "Saturday April 20",
      postDate: "04-18-2024",
      workout: "In The Zone 2 #1",
      duration: '2h',
      stressPoints: '95',
      eventID1: "4342491",
      eventID2: "4342585",
    })
  ];
  