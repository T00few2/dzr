import next from "next";
import { ZwiftyFiftyCalender } from "../the-zwifty-fifty/ZwiftyFiftyCalender";
import { AfterPartyCalender } from "../dzr-after-party/AfterPartyCalender";

export function racePosts() {
    const tzfRaces = ZwiftyFiftyCalender.filter(data => data.raceID !== '');
    const dafRaces = AfterPartyCalender.filter(data => data.raceID !== '');
    const allRaces = tzfRaces.concat(dafRaces);

    // Sort allRaces by postDate
    allRaces.sort((a, b) => new Date(a.postDate).getTime() - new Date(b.postDate).getTime());

    // Log the sorted allRaces to the console
    console.log(allRaces);

    {allRaces.map((allRaces)=> (
        console.log(allRaces.postDate)))}
    return allRaces
}