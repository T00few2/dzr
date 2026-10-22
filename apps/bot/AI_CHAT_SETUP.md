# AI Chat Bot Setup Guide

This guide explains how to set up the AI-powered natural language interface for your Discord bot.

## Overview

Users can now interact with the bot using natural language by mentioning it:
```
@YourBot show me stats for @Chris
@YourBot compare @John, @Mike, and @Sarah
@YourBot what's my zwift id?
```

The bot uses OpenAI's GPT-4.1-mini (configurable) to understand the request and execute the appropriate command.

## Setup Instructions

### 1. Get an OpenAI API Key

1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign up or log in
3. Navigate to **API Keys** section
4. Click **"Create new secret key"**
5. Copy the key (it starts with `sk-...`)
6. **Important:** Add credits to your account (Settings → Billing)

### 2. Add API Key to Environment Variables

Add this line to your `.env` file in the `bot/` directory:

```env
OPENAI_API_KEY=sk-your-api-key-here
```

### 3. Install Dependencies

Run this command in the `bot/` directory:

```bash
npm install
```

This will install the `openai` package (version 4.77.0+).

### 4. Restart Your Bot

Restart the bot to load the new configuration:

```bash
node bot.js
```

You should see the bot start without any OpenAI warnings.

## Features

### Supported Commands

The AI can understand natural language and execute these commands:

1. **rider_stats** - Get stats for a rider
   - "Show me stats for @Chris"
   - "What are the stats for Zwift ID 123456?"

2. **team_stats** - Compare multiple riders
   - "Compare @John, @Mike, and @Sarah"
   - "Show team stats for @Chris and @Tom"

3. **whoami** - Get your own Zwift ID
   - "What's my Zwift ID?"
   - "Show me my linked ID"

4. **get_zwiftid** - Get someone's Zwift ID
   - "What's @Chris's Zwift ID?"
   - "Show me Chris's linked ID"

5. **my_zwiftid** - Link your Zwift ID
   - "Link my Zwift ID 123456"
   - "Search for my name starting with 'Chr'"

6. **set_zwiftid** - Link someone else's Zwift ID (requires Manage Messages permission)
   - "Set @Chris's Zwift ID to 123456"
   - "Link @John to Zwift ID 789012"

7. **browse_riders** - Search for riders
   - "Search for riders starting with 'And'"
   - "Find riders named Chris"

8. **event_results** - Search event results
   - "Show results for 'DZR Team Race'"
   - "Find events matching 'Sunday'"

9. **get_help_article** - Access knowledge base
   - "How do I link my ZwiftID?"
   - "What are the membership options?"

10. **get_dzr_teams** - Get team information
    - "Which teams are looking for riders?"
    - "Show me the ZRL teams"

### Conversation Context

The bot remembers your conversation for **30 minutes** or the **last 20 messages** (whichever comes first).

This allows follow-up questions:
```
User: @YourBot show stats for @Chris
Bot: [shows Chris's stats]

User: @YourBot now compare him with @John
Bot: [understands "him" = Chris, shows comparison]
```

### Works in All Channels

The AI chat works in **all channels** where the bot has access. Users just need to mention the bot to trigger it.

## Configuration

You can adjust these settings in `bot/handlers/aiChatHandler.js`:

```javascript
// Conversation settings
const CONVERSATION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const MAX_CONVERSATION_LENGTH = 20;          // 20 messages

// AI Model Configuration
const AI_CONFIG = {
  model: "gpt-4.1-mini",  // Options: "gpt-4o-mini", "gpt-4.1-mini", "gpt-4o", "gpt-4.1"
  temperature: 0.3,       // Lower = more deterministic (0.0-2.0)
  maxTokens: 800,         // Maximum response length
  maxRetries: 2,          // Retry attempts for rate limits
  retryDelayMs: 2000,     // Base delay between retries (exponential backoff)
};
```

### Available Models

| Model | Best For | Speed | Cost |
|-------|----------|-------|------|
| `gpt-4o-mini` | Fast responses, basic tasks | ⚡⚡⚡ | $ |
| `gpt-4.1-mini` | Better instruction following | ⚡⚡⚡ | $ |
| `gpt-4o` | Complex reasoning | ⚡⚡ | $$$ |
| `gpt-4.1` | Best accuracy, agentic tasks | ⚡⚡ | $$$ |

**Default:** `gpt-4.1-mini` - Good balance of accuracy and cost.

## Cost Estimates

Using `gpt-4o-mini` or `gpt-4.1-mini`:
- Input: ~$0.15-0.40 / 1M tokens
- Output: ~$0.60-1.60 / 1M tokens

**Example:** 1,000 messages ≈ $0.40-1.00

Using `gpt-4o` or `gpt-4.1`:
- Input: ~$2.50-5.00 / 1M tokens
- Output: ~$10.00-15.00 / 1M tokens

**Example:** 1,000 messages ≈ $6.50-15.00

💡 **Tip:** Start with `gpt-4.1-mini` - it's fast, affordable, and has excellent instruction following!

## Technical Improvements (v2.0)

This version includes significant improvements:

### Modern Tools API
- Migrated from deprecated `functions` to `tools` API format
- Better compatibility with newer OpenAI models
- Support for parallel tool execution

### Improved Accuracy
- Lower temperature (0.3) for more deterministic function selection
- Better system prompt with context and guidelines
- Increased max_tokens (800) for more complete responses

### Reliability
- Automatic retry with exponential backoff for rate limits
- Graceful error handling with user-friendly messages
- Logging for debugging and analytics

### Parallel Execution
- Multiple tools can be called simultaneously when appropriate
- Faster response times for complex queries

## Troubleshooting

### "OpenAI not configured" Warning

**Problem:** Bot starts but shows: `⚠️ OpenAI not configured. AI chat features will be disabled.`

**Solutions:**
1. Check that `OPENAI_API_KEY` is in your `.env` file
2. Make sure the key starts with `sk-`
3. Restart the bot after adding the key

### "Insufficient quota" Error

**Problem:** Bot responds: `⚠️ OpenAI API quota exceeded.`

**Solutions:**
1. Go to [platform.openai.com/account/billing](https://platform.openai.com/account/billing)
2. Add payment method and credits
3. Check your usage limits

### "Invalid API key" Error

**Problem:** Bot responds: `⚠️ OpenAI API key is invalid.`

**Solutions:**
1. Generate a new API key on OpenAI platform
2. Make sure you copied the entire key (starts with `sk-`)
3. Update `.env` file with new key
4. Restart bot

### "Too many requests" Error

**Problem:** Bot responds: `⚠️ Too many requests. Please wait a moment and try again.`

**Solutions:**
1. Wait a few seconds and retry
2. The bot automatically retries with exponential backoff
3. If persistent, check your OpenAI rate limits

### Bot Doesn't Respond

**Problem:** You mention the bot but nothing happens.

**Checklist:**
- ✅ Did you mention the bot? (`@YourBot`)
- ✅ Is the bot online?
- ✅ Does the bot have message permissions in that channel?
- ✅ Is OpenAI configured? (Check bot startup logs)

### Wrong Function Called

**Problem:** Bot calls the wrong command for your request.

**Solutions:**
1. Try being more specific in your request
2. Lower the temperature in `AI_CONFIG` (e.g., 0.2)
3. Consider using a more powerful model (e.g., `gpt-4o`)

## Testing

Test the AI chat with these examples:

```
@YourBot hello

@YourBot what can you do?

@YourBot show me stats for @[YourUsername]

@YourBot what's my zwift id?

@YourBot search for riders starting with "Chr"

@YourBot which teams are looking for riders?
```

## Privacy & Data

- **Conversations are temporary** - Stored in memory for 30 minutes, then deleted
- **Bot restart clears all conversations** - No persistent storage
- **OpenAI processes messages** - Messages are sent to OpenAI's API
- **Permanent data** - Only Zwift ID links are stored permanently in Firebase

## Analytics & Logging

The bot logs tool calls for debugging:

```
🤖 Executing tool: rider_stats { user: 'Chris#1234', guild: 'DZR', args: { zwiftid: '123456' } }
```

You can use these logs to understand usage patterns and improve the bot.

## Support

If you encounter issues:
1. Check the bot console logs for errors
2. Verify your `.env` configuration
3. Test with simple commands first
4. Check OpenAI API status at [status.openai.com](https://status.openai.com)

---

**Enjoy your AI-powered Discord bot!** 🤖🚴

## Zwift routes (`zwift_routes`, `zwift_route_details`, `zwift_segments`)

The club bot answers route, climb and segment questions itself from the bundled `zwift-data`
package (`services/zwiftRoutes.js`): distance, elevation, lead-in, and the climbs and sprints along
each route. It is local, so these answers are instant and free. The package is a snapshot; bump
`zwift-data` now and then, and a route newer than it is passed to DZR Helper's web search.

## Route profile images (`route_profile_image`)

The club bot can post a route's elevation profile as a PNG, with climbs and sprints banded, and
close-ups of climbs coloured by gradient (the site's `<4% / 4–7% / 7–10% / 10%+` bands). The data
comes from the site's public `/api/route-profile`, the same profile the series pages draw, so laps,
lead-in and segment positions match the site. The bot only draws (`services/routeProfileChart.js`,
using `canvas`). Profiles are cached for an hour.

## DZR Helper (`ask_helper`)

Both the club bot and DZR Coach can call `ask_helper` when none of their own tools fit. It runs a
separate, read-only research loop (`services/helperAgent.js`) and returns an answer with source
links, which the calling bot rewords for the member.

What the helper can read:

- The web (OpenAI's built-in `web_search` tool)
- Zwift routes, segments and worlds from the bundled `zwift-data` package (`services/zwiftRoutes.js`):
  distance, elevation, lead-in and the climbs and sprints along each route. It is a snapshot, so
  routes released after the package version fall back to web search
- The `bot_knowledge` articles
- DCU E-serien's race calendar via `dcu_eserien_races` (`services/dcuESerien.js`), read from the
  public API behind dansk-ecykling.dk/schedule: date, route, world, laps, distance, point segments,
  division groups and Zwift event ids. The club bot has it too, so "DZR løbet" resolves directly
- DCU E-serien results via `dcu_eserien_results` (`services/dcuClubResults.js`): DZR riders' place
  in the full field, time and points for one race, plus the season table and the club ranking.
  It uses the club API login `DCU_E_SERIE_USERNAME` / `DCU_E_SERIE_SECRET`. The club bot has it
  too, so "hvordan gik DZR løbet" does not go through ZwiftPower
- Any public https page, via `read_web_page` (`services/webPage.js`), so it can open a race calendar a
  search found. Private and local addresses are refused, redirects included
- Zwift events via Zwift's public events API (`services/zwiftEvents.js`): route, world, laps or distance,
  start time and categories on another course. Zwift event pages are drawn by JavaScript, so this is
  the only way to read an event's route. The club bot has `zwift_event` too, for pasted event links
- The latest `club_stats` roster
- ZwiftPower via the API's existing GET routes `/rider_data/<id>` and `/team_results/<club>`
  (`services/zwiftPowerReader.js`). The ZwiftPower logins never leave `apps/api`, and the
  organizer account is never used.

Limits: club members only; ZwiftPower lookups only for DZR club riders or the asking member; 5 tool
rounds and 4 ZwiftPower calls per run; results cached for 10 minutes; a per-member daily run cap.
Helper tokens inside a Coach turn count against that athlete's daily coach budget.

Every run is logged to the Firestore collection `helper_runs` (tools used, ZwiftPower lookups and
refusals, tokens, latency, outcome). Club questions are logged; Coach questions are not.

Optional env:

| Variable | Default |
|---|---|
| `HELPER_MODEL` | `COACH_MODEL` |
| `HELPER_REASONING_EFFORT` | `medium` |
| `HELPER_MAX_OUTPUT_TOKENS` | `6000` |
| `HELPER_WEB_SEARCH` | `on` (`off` disables web search) |
| `HELPER_DAILY_RUNS_PER_USER` | `15` (`0` = no cap) |
| `ZWIFTPOWER_CLUB_ID` | `11939` |
