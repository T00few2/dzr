import { racePosts } from "../racePosts";

const Races = racePosts()

export async function GET(request: Request) {

      const blogPosts = Races.map(race => ({
        title: race.raceSeries, // Use route as title
        description: `Date: ${race.date} <br/> World: ${race.world} <br/> Route: ${race.route} <br/> Laps: ${race.laps} <br/>`, // Use date as description
        link: `https://www.zwift.com/eu/events/view/${race.raceID}`, // Zwift link using raceID
        pubDate: race.postDate, // Use postDate as pubDate
        date: race.date,
        guid: race.raceID // Use raceID as the unique identifier for <guid>
    }));
  
    const feed = `<?xml version="1.0" encoding="UTF-8" ?>
    <rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
          <channel>
              <title>DZR Racing Series</title>
              <link>https://dzrracingseries.com</link>
              <description>Danish Zwift Racers - Racing Series</description>
              <language>en-us</language>
              <atom:link href="https://www.dzrracingseries.com/api/feed" rel="self" type="application/rss+xml" />
              ${blogPosts
                .map(
                  (post) => `
              <item>
                  <title>${post.title}</title>
                  <link>${post.link}</link>
                  <description><![CDATA[${post.description}]]></description>
                  <pubDate>${post.pubDate}</pubDate>
                  <guid isPermaLink="false">${post.title}; ${post.date}; ID: ${post.guid}</guid>
              </item>
              `
                )
                .join("")}
          </channel>
      </rss>`;
  
      const headers = new Headers();
      headers.set("Content-Type", "application/rss+xml");
    
      return new Response(feed, {
          status: 200,
          headers: headers
      });
}
  