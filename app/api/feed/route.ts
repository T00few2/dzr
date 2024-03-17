import { racePosts } from "../racePosts";

const zfRaces = racePosts()

export async function GET(request: Request) {
    
    
    const blogPosts = [
      {
        title: "DZR After Party Series",
        description: "Thursday March 21.",
        link: "https://dzrracingseries.com/dzr-after-party",
        pubDate: new Date().toUTCString(),
      },
    ];
  
    const feed = `<?xml version="1.0" encoding="UTF-8" ?>
      <rss version="2.0">
          <channel>
              <title>DZR Racing Series</title>
              <link>https://dzrracingseries.com</link>
              <description>Danish Zwift Racers - Racing Series</description>
              <language>en-us</language>
              ${blogPosts
                .map(
                  (post) => `
              <item>
                  <title>${post.title}</title>
                  <link>${post.link}</link>
                  <description>${post.description}</description>
                  <pubDate>${post.pubDate}</pubDate>
              </item>
              `
                )
                .join("")}
          </channel>
      </rss>`;
  
    return new Response(feed, {
      status: 200,
      headers: { "Content-Type": "application/rss+xml" },
    });
  }