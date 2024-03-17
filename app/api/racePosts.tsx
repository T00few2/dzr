import next from "next";
import { ZwiftyFiftyCalender } from "../the-zwifty-fifty/ZwiftyFiftyCalender";
import { AfterPartyCalender } from "../dzr-after-party/AfterPartyCalender";

export function racePosts() {
    const tzfRaces = ZwiftyFiftyCalender.filter(data => data.raceID !== '');
    const dafRaces = AfterPartyCalender.filter(data => data.raceID !== '');

    // Add raceSeries property to dafRaces
    const dafRaces_ = dafRaces.map(race => ({
        ...race,
        raceSeries: "DZR After Party Series"
    }));

    // Add raceSeries property to tzfRaces
    const tzfRaces_ = tzfRaces.map(race => ({
        ...race,
        raceSeries: "The Zwifty Fifty"
    }));
    const allRaces = tzfRaces_.concat(dafRaces_);

    // Sort allRaces by postDate
    allRaces.sort((a, b) => new Date(a.postDate).getTime() - new Date(b.postDate).getTime());
    
    return allRaces
}