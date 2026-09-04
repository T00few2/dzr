const OpenAI = require("openai");
const { ChannelType } = require("discord.js");
const config = require("../config/config");
const {
  getAllBotKnowledge,
  getUserZwiftId,
  getDZRTeamsAndSeries,
  recordCoachUsage,
  getCoachProfile,
  mergeCoachProfile,
  confirmCoachProfile,
  rejectCoachProfile,
  formatCoachProfileForPrompt,
  listCoachChatNotes,
  addCoachChatNotes,
} = require("../services/firebase");
const { lookupZrlCategory } = require("../services/zrlCategory");
const { 
  handleRiderStats, 
  handleTeamStats, 
  handleWhoAmI, 
  handleGetZwiftId, 
  handleBrowseRiders, 
  handleEventResults,
  handleMyZwiftId,
  handleSetZwiftId
} = require("./commandHandlers");
const { startQuizFromMessage } = require("../services/quizService");
const strava = require("../services/stravaService");
const { handoffCoachingFromMessage, NOT_CLUB_MEMBER_TEXT } = require("../services/coachDm");
const {
  shouldSkipExtract,
  buildExtractMessages,
  parseExtractedNotes,
  retrieveRelevantNotes,
  searchNotes,
  formatNotesForPrompt,
} = require("../services/coachChatNotes");

// Initialize OpenAI client
let openai;
try {
  if (config.openai?.apiKey) {
    openai = new OpenAI({
      apiKey: config.openai.apiKey
    });
  }
} catch (error) {
  console.warn("⚠️ OpenAI not configured. AI chat features will be disabled.");
}

// Store conversations per user
const userConversations = new Map();
const conversationTimers = new Map();
const conversationModes = new Map(); // conversationKey -> 'coach' | 'club'

// Configuration
const CONVERSATION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const MAX_CONVERSATION_LENGTH = 20; // Last 20 messages (10 exchanges)
const MAX_TOOL_ITERATIONS = 2;
const COACH_MAX_TOOL_ITERATIONS = 4;
const COACH_MAX_TOKENS = 16000;
const COACH_REASONING_EFFORT = "low";

// AI Model Configuration - can be changed to test different models
const AI_CONFIG = {
  model: "gpt-5-mini",    // Options: "gpt-5-mini", "gpt-4.1-mini", "gpt-5-nano", "gpt-4.1-nano"
  temperature: 0.3,       // Used only by models that support sampling (not gpt-5-mini/nano)
  maxTokens: 800,         // Max completion tokens for replies
  maxRetries: 2,          // Retry attempts for rate limits
  retryDelayMs: 2000,     // Base delay between retries
  // gpt-5* defaults to medium reasoning (slower/costlier). low keeps Discord snappy for tool routing.
  reasoningEffort: "low",
};

function isGpt5Family(model = AI_CONFIG.model) {
  return typeof model === "string" && model.startsWith("gpt-5");
}

/**
 * Build chat.completions params compatible with both 4.x and 5.x models.
 * gpt-5-mini/nano reject custom temperature and require max_completion_tokens.
 */
function buildChatCompletionParams({ messages, tools, toolChoice, maxTokens, temperature, reasoningEffort }) {
  const model = AI_CONFIG.model;
  const params = {
    model,
    messages,
  };

  if (tools) {
    params.tools = tools;
    params.tool_choice = toolChoice || "auto";
  }

  if (isGpt5Family(model)) {
    params.max_completion_tokens = maxTokens ?? AI_CONFIG.maxTokens;
    const effort = reasoningEffort || AI_CONFIG.reasoningEffort;
    if (effort) {
      params.reasoning_effort = effort;
    }
  } else {
    params.max_tokens = maxTokens ?? AI_CONFIG.maxTokens;
    params.temperature = temperature ?? AI_CONFIG.temperature;
  }

  return params;
}

// Tool-calling safety (club assistant). Coaching uses COACH_MAX_TOOL_ITERATIONS.

// These tools already produce user-visible Discord messages via existing handlers.
// If we also ask the LLM to "respond with results" afterwards, it often becomes duplicate/noisy.
const TOOLS_THAT_REPLY_DIRECTLY = new Set([
  "rider_stats",
  "team_stats",
  "whoami",
  "get_zwiftid",
  "browse_riders",
  "event_results",
  "my_zwiftid",
  "set_zwiftid",
  "start_quiz",
]);

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ success: false, message: "Failed to serialize tool result." });
  }
}

const MY_PAGES_URL = "https://www.dzrracingseries.com/members-zone/my-pages";

function formatMemoryConfirmMessages(summary) {
  const parts = String(summary || "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  const bullets = (parts.length ? parts : ["dine træningsrammer"])
    .map((p) => `• ${p}`)
    .join("\n");
  const confirmMessageDa =
    `Jeg har gemt følgende til fremtidige samtaler:\n${bullets}\n\n` +
    `Skriv **nej** hvis du ikke vil have det gemt. Du kan altid se og slette det under Mine sider:\n${MY_PAGES_URL}`;
  const confirmMessageEn =
    `I've saved the following for future conversations:\n${bullets}\n\n` +
    `Reply **no** if you don't want this stored. You can always view and delete it on My Pages:\n${MY_PAGES_URL}`;
  return { confirmMessageDa, confirmMessageEn };
}

/**
 * Compact tool results before adding them to the model context.
 * Big payloads (e.g. teams arrays) quickly degrade model performance & cost.
 */
function compactToolResult(result) {
  if (!result || typeof result !== "object") return result;

  const base = {
    tool_call_id: result.tool_call_id,
    success: !!result.success,
  };

  if (typeof result.message === "string" && result.message.length > 0) {
    base.message = result.message.slice(0, 500);
  }

  // Common payloads
  if (result.rider) {
    base.rider = result.rider;
  }
  if (result.team) {
    base.team = Array.isArray(result.team) ? result.team.slice(0, 8) : result.team;
    if (Array.isArray(result.team) && result.team.length > 8) base.team_truncated = true;
  }
  if (result.teams) {
    base.teams = Array.isArray(result.teams) ? result.teams.slice(0, 25) : result.teams;
    if (Array.isArray(result.teams) && result.teams.length > 25) base.teams_truncated = true;
  }
  if (typeof result.title === "string" || typeof result.content === "string") {
    base.title = typeof result.title === "string" ? result.title.slice(0, 200) : undefined;
    base.content = typeof result.content === "string" ? result.content.slice(0, 2000) : undefined;
    base.tags = Array.isArray(result.tags) ? result.tags.slice(0, 25) : undefined;
  }
  if (result.zwiftpower) base.zwiftpower = result.zwiftpower;
  if (result.athlete) base.athlete = result.athlete;
  if (result.stats) base.stats = result.stats;
  if (result.zones) base.zones = result.zones;
  if (Array.isArray(result.activities)) base.activities = result.activities.slice(0, 40);
  if (result.activity) base.activity = result.activity;
  if (typeof result.days === "number") base.days = result.days;
  if (result.needs_reconnect) base.needs_reconnect = true;
  if (result.not_club_member) base.not_club_member = true;
  if (typeof result.connectUrl === "string") base.connectUrl = result.connectUrl.slice(0, 500);
  if (result.metadata) base.metadata = result.metadata;
  if (result.series) base.series = result.series;
  if (result.zrl) base.zrl = result.zrl;
  if (typeof result.summary === "string") base.summary = result.summary.slice(0, 500);
  if (typeof result.confirmMessageDa === "string") base.confirmMessageDa = result.confirmMessageDa.slice(0, 1500);
  if (typeof result.confirmMessageEn === "string") base.confirmMessageEn = result.confirmMessageEn.slice(0, 1500);
  if (typeof result.instruction === "string") base.instruction = result.instruction.slice(0, 800);
  if (typeof result.editUrl === "string") base.editUrl = result.editUrl.slice(0, 300);
  if (result.saved) base.saved = true;
  if (result.confirmed) base.confirmed = true;
  if (result.rejected) base.rejected = true;
  if (Array.isArray(result.notes)) {
    base.notes = result.notes.slice(0, 8);
    if (result.notes.length > 8) base.notes_truncated = true;
  }
  if (result.profile && typeof result.profile === "object") base.profile = result.profile;
  if (Array.isArray(result.matches)) base.matches = result.matches.slice(0, 3);
  if (Array.isArray(result.available)) base.available = result.available.slice(0, 20);
  if (typeof result.error === "string") base.error = result.error.slice(0, 300);

  // Fallback: keep only small scalar keys
  const keepScalars = {};
  for (const [k, v] of Object.entries(result)) {
    if (k in base) continue;
    if (v === null || v === undefined) continue;
    if (typeof v === "string" && v.length <= 200) keepScalars[k] = v;
    else if (typeof v === "number" || typeof v === "boolean") keepScalars[k] = v;
  }
  if (Object.keys(keepScalars).length > 0) base.extra = keepScalars;

  return base;
}

function getConversationKey(message) {
  const userId = message?.author?.id || "unknown_user";
  const channelId = message?.channelId || message?.channel?.id || "unknown_channel";
  const guildId = message?.guild?.id || message?.guildId || "dm";
  return `${guildId}:${channelId}:${userId}`;
}

function markCoachingMode(userId, dmChannelId) {
  if (!userId || !dmChannelId) return;
  conversationModes.set(`dm:${dmChannelId}:${userId}`, "coach");
}

function isCoachingIntent(text) {
  const t = String(text || "").toLowerCase();
  if (!t) return false;
  const patterns = [
    /\b\/?coach(ing)?\b/,
    /\bcoach me\b/,
    /\btrænings(råd|plan|coach)\b/,
    /\bhvad skal jeg træne\b/,
    /\bhow should i train\b/,
    /\bhow was my (ride|run|workout|training|session|week)\b/,
    /\btraining (advice|plan|load)\b/,
    /\bshould i (ride|rest|train|taper)\b/,
    /\bskal jeg (køre|træne|hvile)\b/,
    /\brecovery advice\b/,
    /\bovertraining\b/,
  ];
  return patterns.some((p) => p.test(t));
}

async function isReplyToBot(message, client) {
  const refId = message?.reference?.messageId;
  if (!refId) return false;

  try {
    const cached = message.channel?.messages?.cache?.get(refId);
    if (cached) return cached.author?.id === client.user.id;

    // Fallback: fetch referenced message (may fail if missing perms / deleted)
    const fetched = await message.channel.messages.fetch(refId).catch(() => null);
    if (!fetched) return false;
    return fetched.author?.id === client.user.id;
  } catch {
    return false;
  }
}

/**
 * Build a short, human-friendly rider commentary from summarized stats
 */
function buildRiderComment(rider) {
  if (!rider || typeof rider !== 'object') return null;

  const name = rider.name || 'This rider';
  const ftpWkg = rider?.ftp?.wkg;
  const w5 = rider?.power?.w300?.wkg;   // 5m
  const w20 = rider?.power?.w1200?.wkg; // 20m
  const phenotype = rider?.phenotype || rider?.phenotype?.value;
  const veloCat = rider?.velo?.category;

  const parts = [];

  if (ftpWkg && ftpWkg > 4.0) {
    parts.push(`${name} is packing a serious diesel engine`);
  } else if (ftpWkg && ftpWkg > 3.2) {
    parts.push(`${name} shows solid endurance legs`);
  }

  if (w5 && (!w20 || w5 - w20 > 0.5)) {
    parts.push('short‑burst power pops');
  } else if (w20 && (!w5 || w20 - w5 > 0.2)) {
    parts.push('all‑day power stands out');
  }

  if (phenotype) {
    parts.push(`phenotype: ${phenotype}`);
  }

  if (veloCat) {
    parts.push(`vELO category: ${veloCat}`);
  }

  if (parts.length === 0) {
    return `${name} looks balanced with both snap and staying power.`;
  }

  return parts.join(' • ') + '.';
}

/**
 * Build a short, human-friendly team commentary from summarized team stats
 */
function buildTeamComment(team) {
  if (!Array.isArray(team) || team.length === 0) return null;

  const by = (selector) => team
    .map(r => ({ r, val: selector(r) }))
    .filter(x => typeof x.val === 'number' && Number.isFinite(x.val));

  const ftp = by(r => r?.ftp?.wkg).sort((a,b) => b.val - a.val);
  const w5 = by(r => r?.power?.w300?.wkg).sort((a,b) => b.val - a.val);
  const w20 = by(r => r?.power?.w1200?.wkg).sort((a,b) => b.val - a.val);

  const parts = [];
  if (ftp.length > 0) {
    const top = ftp[0];
    parts.push(`${top.r.name} is the diesel up the climbs`);
  }
  if (w5.length > 0) {
    const top = w5[0];
    parts.push(`${top.r.name} brings the mid‑range punch`);
  }
  if (w20.length > 0) {
    const top = w20[0];
    parts.push(`${top.r.name} holds the line on long efforts`);
  }

  if (parts.length === 0) {
    return `This lineup looks balanced across short and sustained power.`;
  }
  return parts.slice(0, 2).join(' • ') + '.';
}

/**
 * OpenAI Tool Definitions - Using modern tools API format
 */
const toolDefinitions = [
  {
    type: "function",
    function: {
      name: "get_help_article",
      description: "Fetch help/knowledge articles configured by the admin (onboarding, ZwiftID, TrainerDX, club info, etc.). Call once per topic. For ZRL category placement, use zrl_category instead.",
      parameters: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            description: "Short topic or keyword describing what help is needed (e.g. 'zwiftid', 'TrainerDX', 'forening')."
          }
        },
        required: ["topic"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "zrl_category",
      description: "Determine a rider's Zwift Racing League (ZRL) pace-group category by combining admin ZRL limits with the rider's current watt stats. Use this whenever someone asks which ZRL category/division/gruppe they or another rider belong to.",
      parameters: {
        type: "object",
        properties: {
          zwiftid: {
            type: "string",
            description: "The Zwift ID of the rider (numeric string)"
          },
          discord_username: {
            type: "string",
            description: "The Discord username or mention (e.g. '@Chris' or 'Chris'). Omit to use the person asking."
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_dzr_teams",
      description: "Get structured information about Danish Zwift Racers (DZR) teams and race series derived from backend-managed role panels.",
      parameters: {
        type: "object",
        properties: {
          series: {
            type: "string",
            description: "Optional race series filter, e.g. 'WTRL ZRL', 'WTRL TTT', 'DRS', 'Club Ladder'."
          },
          division: {
            type: "string",
            description: "Optional division filter, e.g. 'A1', 'B2', 'Doppio', 'Diamond'."
          },
          looking_for_riders: {
            type: "boolean",
            description: "If true, only return teams that are actively looking for riders."
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "rider_stats",
      description: "Fetch stats for a single rider by their Zwift ID or Discord user mention",
      parameters: {
        type: "object",
        properties: {
          zwiftid: {
            type: "string",
            description: "The Zwift ID of the rider (numeric string)"
          },
          discord_username: {
            type: "string",
            description: "The Discord username or mention (e.g., '@Chris' or 'Chris')"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "team_stats",
      description: "Compare stats for multiple riders (2-8 riders). Provide Discord usernames or mentions.",
      parameters: {
        type: "object",
        properties: {
          riders: {
            type: "array",
            items: { type: "string" },
            description: "Array of Discord usernames or mentions to compare (e.g., ['@Chris', '@John', '@Mike'])",
            minItems: 2,
            maxItems: 8
          }
        },
        required: ["riders"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "whoami",
      description: "Get the Zwift ID linked to the user who is asking",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_zwiftid",
      description: "Get the linked Zwift ID for a specific Discord user",
      parameters: {
        type: "object",
        properties: {
          discord_username: {
            type: "string",
            description: "The Discord username or mention"
          }
        },
        required: ["discord_username"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "browse_riders",
      description: "Search for riders by name (first 3+ letters)",
      parameters: {
        type: "object",
        properties: {
          searchterm: {
            type: "string",
            description: "First 3 or more letters of the rider's name"
          }
        },
        required: ["searchterm"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "event_results",
      description: "Get team results from events matching a search string",
      parameters: {
        type: "object",
        properties: {
          search: {
            type: "string",
            description: "Search string to match in event titles"
          }
        },
        required: ["search"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "start_quiz",
      description: "Start a Zwift route quiz in the current channel. Use when the user asks for a quiz, route quiz, or ZwiftQuiz-style question.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "my_zwiftid",
      description: "Link the user's Discord account to their Zwift ID. Can provide direct Zwift ID or search term.",
      parameters: {
        type: "object",
        properties: {
          zwiftid: {
            type: "string",
            description: "Direct Zwift ID to link (numeric string)"
          },
          searchterm: {
            type: "string",
            description: "First 3+ letters of name to search for in club stats"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "set_zwiftid",
      description: "Link a Discord user's account to a Zwift ID (admin/moderator function). Requires manage messages permission.",
      parameters: {
        type: "object",
        properties: {
          discord_username: {
            type: "string",
            description: "The Discord username or mention of the user to link"
          },
          zwiftid: {
            type: "string",
            description: "Direct Zwift ID to link"
          },
          searchterm: {
            type: "string",
            description: "First 3+ letters to search for the rider"
          }
        },
        required: ["discord_username"]
      }
    }
  }
];

const coachToolDefinitions = [
  {
    type: "function",
    function: {
      name: "get_athlete_profile",
      description: "Get the asking athlete's Strava profile (weight, FTP if present, clubs). Always the caller — never another member.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "get_athlete_stats",
      description: "Get the asking athlete's Strava totals (recent / YTD / all-time ride and run volume).",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "get_athlete_zones",
      description: "Get the asking athlete's Strava heart-rate and power zones.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "get_recent_activities",
      description: "List the asking athlete's recent Strava activities (summaries only). Use this first, then get_activity_details for one session they asked about.",
      parameters: {
        type: "object",
        properties: {
          days: {
            type: "number",
            description: "Lookback window in days (1-28). Default 14."
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_activity_details",
      description: "Get details for one of the asking athlete's Strava activities by id from get_recent_activities.",
      parameters: {
        type: "object",
        properties: {
          activity_id: {
            type: "string",
            description: "Strava activity id"
          }
        },
        required: ["activity_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_zwiftpower_context",
      description: "Optional ZwiftPower snapshot for the asking athlete (category, phenotype, FTP) if they have a linked Zwift ID.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "update_athlete_memory",
      description: "Save durable facts the athlete just stated: ride frequency, sports, weekly slots, lasting injuries, goals, AND coaching-style preferences (short messages, language, tone). Do not save illness, fatigue, mood, skipped sessions, or how a ride felt — those are ephemeral. Do not save a busy Strava week as a rule. Do not save language just because the current message is in Danish or English. After saving, use the provided confirmMessage in your reply.",
      parameters: {
        type: "object",
        properties: {
          ridesPerWeek: {
            type: "object",
            description: "Typical ride count per week, e.g. {min:3,max:4}",
            properties: {
              min: { type: "number" },
              max: { type: "number" }
            }
          },
          sports: {
            type: "array",
            items: { type: "string" },
            description: "Sports they do, e.g. cycling, running, strength"
          },
          weekly: {
            type: "array",
            description: "Fixed weekly slots",
            items: {
              type: "object",
              properties: {
                sport: { type: "string" },
                days: { type: "array", items: { type: "string" } }
              }
            }
          },
          injuries: {
            type: "array",
            items: {
              type: "object",
              properties: {
                text: { type: "string" },
                started: { type: "string" },
                status: { type: "string", enum: ["active", "recovered"] }
              }
            }
          },
          goals: {
            type: "array",
            items: { type: "string" }
          },
          style: {
            type: "object",
            description: "How they want the coach to write. Save when they ask for short messages, Danish/English, a tone, or similar.",
            properties: {
              length: {
                type: "string",
                enum: ["short", "normal", "detailed"],
                description: "short = few sentences / tight bullets"
              },
              language: {
                type: "string",
                enum: ["da", "en"],
                description: "da = always Danish, en = always English"
              },
              tone: {
                type: "string",
                enum: ["direct", "encouraging", "casual"]
              },
              notes: {
                type: "string",
                description: "Other style requests, e.g. bullets only, no emojis"
              }
            }
          },
          summary: {
            type: "string",
            description: "Short phrase listing only the facts just saved, for the confirmation question"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "confirm_athlete_memory",
      description: "Call when the athlete confirms the last saved memory (yes / ja / det stemmer).",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "reject_athlete_memory",
      description: "Call when the athlete rejects the last saved memory (no / nej / forkert). Undoes only that last auto-save.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "search_past_notes",
      description: "Search dated episode notes from earlier coach DMs (feelings, one-off plans, how a ride felt). Use when the athlete refers to something you discussed before that is not in the retrieved notes block. Not for Strava workouts and not for standing constraints.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "What to look for, e.g. easy week, knee, felt ill"
          },
          sinceDays: {
            type: "number",
            description: "Only notes from the last N days (1-365). Omit to search all stored notes."
          }
        },
        required: ["query"]
      }
    }
  }
];

/**
 * Reply to a message, falling back to a plain channel message if the reply itself
 * fails (e.g. Discord can't find the message being replied to anymore — code 50035,
 * MESSAGE_REFERENCE_UNKNOWN_MESSAGE). Never throws: a failed fallback is logged and
 * swallowed so one bad reply can't crash the whole bot process via an unhandled
 * rejection in the messageCreate handler.
 */
async function safeReply(message, content) {
  const payload = typeof content === "string" ? content.trim() : content;
  if (payload == null || payload === "") {
    console.warn("⚠️ safeReply skipped empty content");
    return null;
  }
  try {
    return await message.reply(payload);
  } catch (error) {
    console.warn("⚠️ message.reply failed, falling back to channel.send:", error?.message || error);
    try {
      return await message.channel.send(payload);
    } catch (fallbackError) {
      console.error("⚠️ channel.send fallback also failed:", fallbackError?.message || fallbackError);
      return null;
    }
  }
}

async function safeReplyChunks(message, content) {
  const text = String(content || "");
  if (text.length <= 1900) {
    return safeReply(message, text);
  }
  const chunks = [];
  let remaining = text;
  while (remaining.length > 1900) {
    let idx = remaining.lastIndexOf("\n", 1900);
    if (idx < 900) idx = remaining.lastIndexOf(" ", 1900);
    if (idx < 900) idx = 1900;
    chunks.push(remaining.slice(0, idx).trim());
    remaining = remaining.slice(idx).trim();
  }
  if (remaining) chunks.push(remaining);
  let first = true;
  for (const chunk of chunks) {
    if (first) {
      await safeReply(message, chunk);
      first = false;
    } else {
      await message.channel.send(chunk);
    }
  }
}

/**
 * Create a synthetic interaction object to call existing command handlers
 */
function createSyntheticInteraction(message, options = {}) {
  let replyMessage = null; // Store the initial reply message
  
  const synthetic = {
    // Basic properties
    user: message.author,
    member: message.member,
    guild: message.guild,
    channel: message.channel,
    channelId: message.channelId,
    
    // State flags
    replied: false,
    deferred: false,
    isAIChatInteraction: true, // Flag to indicate this is from AI chat, not slash command
    
    // Options getter
    options: {
      getString: (name) => options.strings?.[name] || null,
      getUser: (name) => options.users?.[name] || null,
      getInteger: (name) => options.integers?.[name] || null,
    },
    
    // Reply methods
    reply: async (content) => {
      synthetic.replied = true;
      // Handle different content types (string, object with embeds, etc.)
      if (typeof content === 'string') {
        replyMessage = await safeReply(message, content);
      } else {
        // For AI chat, skip ephemeral and send directly to channel
        // Remove "publish" button if present
        const cleanContent = { ...content };
        if (cleanContent.components) {
          cleanContent.components = [];
        }
        replyMessage = await safeReply(message, cleanContent);
      }
      return replyMessage;
    },
    
    editReply: async (content) => {
      // If we already have a reply message, edit it
      if (replyMessage) {
        // For AI chat, skip ephemeral and send directly
        const cleanContent = typeof content === 'string' ? content : { ...content };
        if (typeof cleanContent === 'object' && cleanContent.components) {
          cleanContent.components = [];
        }
        return await replyMessage.edit(cleanContent);
      }
      // Otherwise, create the initial reply
      synthetic.replied = true;
      if (typeof content === 'string') {
        replyMessage = await safeReply(message, content);
      } else {
        const cleanContent = { ...content };
        if (cleanContent.components) {
          cleanContent.components = [];
        }
        replyMessage = await safeReply(message, cleanContent);
      }
      return replyMessage;
    },
    
    followUp: async (content) => {
      // Remove publish buttons from follow-ups too
      const cleanContent = typeof content === 'string' ? content : { ...content };
      if (typeof cleanContent === 'object' && cleanContent.components) {
        cleanContent.components = [];
      }
      return await message.channel.send(cleanContent);
    },
    
    // For publish button functionality
    get message() {
      return replyMessage;
    }
  };
  
  return synthetic;
}

/**
 * Resolve Discord username/mention to User object
 */
function resolveUser(userString, message) {
  if (!userString) return null;
  
  // Extract user ID from mention format <@123456789>
  const mentionMatch = userString.match(/<@!?(\d+)>/);
  if (mentionMatch) {
    const userId = mentionMatch[1];
    // Try mentions, then global user cache (DMs may not have a guild)
    const mentioned = message.mentions.users.get(userId);
    if (mentioned) return mentioned;
    if (message.client && message.client.users) {
      return message.client.users.cache.get(userId) || null;
    }
    return null;
  }
  
  // Search by username (case-insensitive)
  const username = userString.replace('@', '').toLowerCase();

  // If we're in a DM, we don't have a guild member list – fall back to the author
  if (!message.guild) {
    const author = message.author;
    if (!author) return null;
    const tag = (author.tag || "").toLowerCase();
    if (
      author.username.toLowerCase() === username ||
      tag === username
    ) {
      return author;
    }
    return null;
  }

  // In guilds, search member cache
  const member = message.guild.members.cache.find(m => 
    m.user.username.toLowerCase() === username || 
    m.user.tag.toLowerCase() === username ||
    m.displayName.toLowerCase() === username
  );
  
  return member?.user || null;
}

/**
 * Execute a single tool call
 */
async function executeSingleToolCall(toolCall, message) {
  const { name, arguments: argsString } = toolCall.function;
  let args;
  
  try {
    args = JSON.parse(argsString || "{}");
  } catch (error) {
    console.error("Error parsing function arguments:", error);
    return { 
      tool_call_id: toolCall.id,
      success: false, 
      message: "Invalid function arguments" 
    };
  }
  
  console.log(`🤖 Executing tool: ${name}`, {
    user: message.author.tag,
    guild: message.guild?.name || 'DM',
    args
  });
  
  try {
    let result;
    
    switch (name) {
      case "rider_stats": {
        const options = {
          strings: {},
          users: {}
        };

        // If no explicit ZwiftID or Discord user was provided, assume user means "my stats"
        if (!args.zwiftid && !args.discord_username) {
          const selfZwiftId = await getUserZwiftId(message.author.id);
          if (!selfZwiftId) {
            const msg =
              "❌ I couldn't find a linked ZwiftID for you.\n\n" +
              "I can link it for you — just reply to this message (or mention me again) with either:\n" +
              "• your ZwiftID (numbers only), or\n" +
              "• the first 3+ letters of your Zwift name.\n\n" +
              "Then I’ll link it and fetch your stats.";
            await safeReply(message, msg);
            return { tool_call_id: toolCall.id, success: false, message: msg };
          }
          options.strings.zwiftid = String(selfZwiftId);
        } else {
          if (args.zwiftid) {
            options.strings.zwiftid = args.zwiftid;
          }

          if (args.discord_username) {
            const user = resolveUser(args.discord_username, message);
            if (!user) {
              await safeReply(message, `❌ Could not find Discord user: ${args.discord_username}`);
              return { tool_call_id: toolCall.id, success: false, message: `Discord user ${args.discord_username} not found` };
            }
            options.users.discorduser = user;
          }
        }

        const interaction = createSyntheticInteraction(message, options);
        result = await handleRiderStats(interaction);
        return { tool_call_id: toolCall.id, ...(result ?? { success: true }) };
      }
      
      case "team_stats": {
        const options = {
          users: {}
        };
        
        if (!args.riders || !Array.isArray(args.riders)) {
          await safeReply(message, "❌ Please specify 2-8 riders to compare.");
          return { tool_call_id: toolCall.id, success: false, message: "Invalid riders array" };
        }
        
        // Resolve all rider usernames to User objects
        for (let i = 0; i < Math.min(args.riders.length, 8); i++) {
          const user = resolveUser(args.riders[i], message);
          if (!user) {
            await safeReply(message, `❌ Could not find Discord user: ${args.riders[i]}`);
            return { tool_call_id: toolCall.id, success: false, message: `Discord user ${args.riders[i]} not found` };
          }
          options.users[`rider${i + 1}`] = user;
        }
        
        const interaction = createSyntheticInteraction(message, options);
        result = await handleTeamStats(interaction);
        return { tool_call_id: toolCall.id, ...(result ?? { success: true }) };
      }
      
      case "whoami": {
        const interaction = createSyntheticInteraction(message);
        await handleWhoAmI(interaction);
        return { tool_call_id: toolCall.id, success: true };
      }
      
      case "get_zwiftid": {
        const options = {
          users: {}
        };
        
        if (args.discord_username) {
          const user = resolveUser(args.discord_username, message);
          if (!user) {
            await safeReply(message, `❌ Could not find Discord user: ${args.discord_username}`);
            return { tool_call_id: toolCall.id, success: false, message: `Discord user ${args.discord_username} not found` };
          }
          options.users.discorduser = user;
        }
        
        const interaction = createSyntheticInteraction(message, options);
        await handleGetZwiftId(interaction);
        return { tool_call_id: toolCall.id, success: true };
      }
      
      case "browse_riders": {
        const options = {
          strings: {
            searchterm: args.searchterm
          }
        };
        
        const interaction = createSyntheticInteraction(message, options);
        await handleBrowseRiders(interaction);
        return { tool_call_id: toolCall.id, success: true };
      }
      
      case "event_results": {
        const options = {
          strings: {
            search: args.search
          }
        };
        
        const interaction = createSyntheticInteraction(message, options);
        await handleEventResults(interaction);
        return { tool_call_id: toolCall.id, success: true };
      }

      case "start_quiz": {
        const result = await startQuizFromMessage(message);
        return {
          tool_call_id: toolCall.id,
          success: !!result?.success,
          message: result?.success
            ? "Quiz posted in the channel."
            : (result?.message || "Failed to start quiz"),
        };
      }
      
      case "my_zwiftid": {
        const options = {
          strings: {}
        };
        
        if (args.zwiftid) {
          options.strings.zwiftid = args.zwiftid;
        }
        
        if (args.searchterm) {
          options.strings.searchterm = args.searchterm;
        }
        
        const interaction = createSyntheticInteraction(message, options);
        await handleMyZwiftId(interaction);
        return { tool_call_id: toolCall.id, success: true };
      }
      
      case "set_zwiftid": {
        // Check permissions
        if (!message.member?.permissions.has('ManageMessages')) {
          await safeReply(message, "❌ You need 'Manage Messages' permission to set Zwift IDs for other users.");
          return { tool_call_id: toolCall.id, success: false, message: "Missing Manage Messages permission" };
        }
        
        const options = {
          strings: {},
          users: {}
        };
        
        if (args.discord_username) {
          const user = resolveUser(args.discord_username, message);
          if (!user) {
            await safeReply(message, `❌ Could not find Discord user: ${args.discord_username}`);
            return { tool_call_id: toolCall.id, success: false, message: `Discord user ${args.discord_username} not found` };
          }
          options.users.discorduser = user;
        }
        
        if (args.zwiftid) {
          options.strings.zwiftid = args.zwiftid;
        }
        
        if (args.searchterm) {
          options.strings.searchterm = args.searchterm;
        }
        
        const interaction = createSyntheticInteraction(message, options);
        await handleSetZwiftId(interaction);
        return { tool_call_id: toolCall.id, success: true };
      }

      case "zrl_category": {
        let zwiftId = args.zwiftid ? String(args.zwiftid) : null;

        if (!zwiftId && args.discord_username) {
          const user = resolveUser(args.discord_username, message);
          if (!user) {
            return {
              tool_call_id: toolCall.id,
              success: false,
              message: `Discord user ${args.discord_username} not found`,
            };
          }
          zwiftId = await getUserZwiftId(user.id);
          if (!zwiftId) {
            const msg =
              `❌ **${user.username}** has not linked their ZwiftID yet.\n\n` +
              `Ask them to DM me their ZwiftID (numbers only) or the first 3+ letters of their Zwift name.`;
            await safeReply(message, msg);
            return { tool_call_id: toolCall.id, success: false, message: msg };
          }
        }

        if (!zwiftId) {
          zwiftId = await getUserZwiftId(message.author.id);
          if (!zwiftId) {
            const msg =
              "❌ I couldn't find a linked ZwiftID for you.\n\n" +
              "Reply with your ZwiftID (numbers only) or the first 3+ letters of your Zwift name, then ask again.";
            await safeReply(message, msg);
            return { tool_call_id: toolCall.id, success: false, message: msg };
          }
        }

        const result = await lookupZrlCategory({ zwiftId });
        return { tool_call_id: toolCall.id, ...result };
      }

      case "get_help_article": {
        const topic = (args.topic || "").toString().toLowerCase();
        const all = await getAllBotKnowledge();
        if (!all || all.length === 0) {
          return { tool_call_id: toolCall.id, success: false, message: "No bot knowledge entries configured." };
        }

        const scored = all.map(entry => {
          const key = (entry.key || entry.id || "").toString().toLowerCase();
          const title = (entry.title || "").toLowerCase();
          const content = (entry.content || "").toLowerCase();
          const tags = Array.isArray(entry.tags) ? entry.tags.map(t => String(t).toLowerCase()) : [];
          let score = 0;
          if (key.includes(topic) || topic.includes(key)) score += 3;
          if (title.includes(topic)) score += 2;
          if (tags.some(t => t.includes(topic) || topic.includes(t))) score += 2;
          if (content.includes(topic)) score += 1;
          return { entry, score };
        }).filter(x => x.score > 0);

        if (scored.length === 0) {
          return {
            tool_call_id: toolCall.id,
            success: false,
            message: `No knowledge entry matched topic '${topic}'.`,
            available: all.map(e => ({ key: e.key || e.id, title: e.title || "", tags: e.tags || [] })),
          };
        }

        scored.sort((a, b) => b.score - a.score);
        const matches = scored.slice(0, 3).map(({ entry }) => ({
          key: entry.key || entry.id,
          title: entry.title || "",
          content: entry.content || "",
          tags: entry.tags || []
        }));
        const best = matches[0];

        return {
          tool_call_id: toolCall.id,
          success: true,
          key: best.key,
          title: best.title,
          content: best.content,
          tags: best.tags,
          matches
        };
      }

      case "get_dzr_teams": {
        const { teams, series } = await getDZRTeamsAndSeries();
        let filteredTeams = teams;

        const normalize = (val) =>
          String(val ?? "")
            .toLowerCase()
            .trim()
            .replace(/[_-]+/g, " ")
            .replace(/\s+/g, " ");

        if (args.series) {
          const s = normalize(args.series);
          filteredTeams = filteredTeams.filter(
            (t) => normalize(t.raceSeries || "") === s
          );
        }
        if (args.division) {
          const d = normalize(args.division);
          const isSingleLetterDivision = /^[abcd]$/.test(d);
          filteredTeams = filteredTeams.filter((t) => {
            const teamDiv = normalize(t.division || "");
            if (!teamDiv) return false;

            // If user asks for "B", match B1/B2/B Development/etc.
            if (isSingleLetterDivision) {
              return teamDiv.startsWith(d);
            }

            // Otherwise, allow exact match or startsWith (covers "b2" vs "b2 something"),
            // and finally fallback to substring match for flexible phrasing.
            return teamDiv === d || teamDiv.startsWith(d) || teamDiv.includes(d);
          });
        }
        if (typeof args.looking_for_riders === "boolean") {
          if (args.looking_for_riders) {
            filteredTeams = filteredTeams.filter((t) => !!t.lookingForRiders);
          }
        }

        // Return a compact payload
        return {
          tool_call_id: toolCall.id,
          success: true,
          teams: filteredTeams.map((t) => ({
            teamName: t.teamName || t.roleName,
            raceSeries: t.raceSeries,
            division: t.division,
            rideTime: t.rideTime,
            lookingForRiders: !!t.lookingForRiders,
            captainDiscordId: t.teamCaptainId || null,
            captainDisplayName: t.captainDisplayName || null,
          })),
          series: series,
        };
      }

      case "get_athlete_profile":
      case "get_athlete_stats":
      case "get_athlete_zones":
      case "get_recent_activities":
      case "get_activity_details":
      case "get_zwiftpower_context": {
        const eligible = await strava.hasClubMemberRole(message.author.id, message.client, message.guild);
        if (!eligible) {
          return { tool_call_id: toolCall.id, ...strava.notClubMemberResult() };
        }
        const discordId = message.author.id;
        let coachResult;
        if (name === "get_athlete_profile") coachResult = await strava.getAthleteProfile(discordId);
        else if (name === "get_athlete_stats") coachResult = await strava.getAthleteStats(discordId);
        else if (name === "get_athlete_zones") coachResult = await strava.getAthleteZones(discordId);
        else if (name === "get_recent_activities") coachResult = await strava.getRecentActivities(discordId, { days: args.days });
        else if (name === "get_activity_details") coachResult = await strava.getActivityDetails(discordId, args.activity_id);
        else coachResult = await strava.getZwiftPowerContext(discordId);
        return { tool_call_id: toolCall.id, ...(coachResult || { success: false, message: "No data" }) };
      }

      case "update_athlete_memory":
      case "confirm_athlete_memory":
      case "reject_athlete_memory": {
        const eligible = await strava.hasClubMemberRole(message.author.id, message.client, message.guild);
        if (!eligible) {
          return { tool_call_id: toolCall.id, ...strava.notClubMemberResult() };
        }
        const discordId = message.author.id;
        try {
          if (name === "update_athlete_memory") {
            const patch = {};
            if (args.ridesPerWeek !== undefined) patch.ridesPerWeek = args.ridesPerWeek;
            if (args.sports !== undefined) patch.sports = args.sports;
            if (args.weekly !== undefined) patch.weekly = args.weekly;
            if (args.injuries !== undefined) patch.injuries = args.injuries;
            if (args.goals !== undefined) patch.goals = args.goals;
            if (args.style !== undefined) patch.style = args.style;
            if (!Object.keys(patch).length) {
              return { tool_call_id: toolCall.id, success: false, message: "No memory fields provided." };
            }
            const profile = await mergeCoachProfile(discordId, patch, { summary: args.summary });
            const { pendingConfirmation, ...stored } = profile;
            const summary = pendingConfirmation?.summary || args.summary || null;
            const { confirmMessageDa, confirmMessageEn } = formatMemoryConfirmMessages(summary);
            return {
              tool_call_id: toolCall.id,
              success: true,
              saved: true,
              summary,
              confirmMessageDa,
              confirmMessageEn,
              profile: {
                ridesPerWeek: stored.ridesPerWeek,
                sports: stored.sports,
                weekly: stored.weekly,
                injuries: stored.injuries,
                goals: stored.goals,
                style: stored.style,
              },
              instruction:
                "Paste confirmMessageDa (or confirmMessageEn if they wrote English) as the memory notice. You may add a short coaching reply after it. Do not shorten it to 'Gemte:'. Even if they prefer short messages, keep this full notice.",
            };
          }
          if (name === "confirm_athlete_memory") {
            const result = await confirmCoachProfile(discordId);
            return {
              tool_call_id: toolCall.id,
              success: result.success,
              confirmed: result.confirmed || false,
              message: result.message || null,
              summary: result.summary || null,
            };
          }
          const result = await rejectCoachProfile(discordId);
          return {
            tool_call_id: toolCall.id,
            success: result.success,
            rejected: result.rejected || false,
            message: result.message || null,
            summary: result.summary || null,
            editUrl: MY_PAGES_URL,
            instruction: result.success
              ? `Say you undid the last save. For older memory they can edit under My Pages: ${MY_PAGES_URL}`
              : undefined,
          };
        } catch (err) {
          console.error("coach memory tool failed:", err?.message || err);
          return { tool_call_id: toolCall.id, success: false, message: "Could not update coach memory." };
        }
      }

      case "search_past_notes": {
        const eligible = await strava.hasClubMemberRole(message.author.id, message.client, message.guild);
        if (!eligible) {
          return { tool_call_id: toolCall.id, ...strava.notClubMemberResult() };
        }
        try {
          const query = String(args.query || "").trim();
          if (!query) {
            return { tool_call_id: toolCall.id, success: false, message: "query is required." };
          }
          const sinceDays = args.sinceDays == null || args.sinceDays === ""
            ? null
            : Math.max(1, Math.min(365, Number(args.sinceDays)));
          const all = await listCoachChatNotes(message.author.id);
          const hits = searchNotes(all, query, { sinceDays: Number.isFinite(sinceDays) ? sinceDays : undefined });
          return {
            tool_call_id: toolCall.id,
            success: true,
            notes: hits.map((note) => ({
              at: note.at,
              kind: note.kind,
              text: note.text,
            })),
            message: hits.length
              ? `Dated episode notes — hints only, not standing rules. Forget/delete is on ${MY_PAGES_URL} (Profile tab).`
              : "No matching episode notes.",
          };
        } catch (err) {
          console.error("search_past_notes failed:", err?.message || err);
          return { tool_call_id: toolCall.id, success: false, message: "Could not search past notes." };
        }
      }
      
      default:
        await safeReply(message, `❌ Unknown command: ${name}`);
        return { tool_call_id: toolCall.id, success: false, message: `Unknown command: ${name}` };
    }
  } catch (error) {
    console.error(`Error executing tool ${name}:`, error);
    await safeReply(message, "⚠️ An error occurred while executing the command. Please try again.");
    return { tool_call_id: toolCall.id, success: false, message: "Unhandled error executing command", error: error?.message };
  }
}

/**
 * Execute multiple tool calls (supports parallel execution)
 */
async function executeToolCalls(toolCalls, message) {
  // Execute all tool calls in parallel
  const results = await Promise.all(
    toolCalls.map(toolCall => executeSingleToolCall(toolCall, message))
  );
  
  return results;
}

/**
 * Clear conversation for a user
 */
function clearConversation(userId) {
  const key = String(userId);

  // If passed a scoped conversation key, just clear that one.
  if (key.includes(":")) {
    clearConversationForKey(key);
    return;
  }

  // Legacy: clear any per-user conversation (old behavior)
  userConversations.delete(key);
  const timer = conversationTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    conversationTimers.delete(key);
  }

  // New: clear all scoped conversations for this user across guilds/channels
  for (const k of Array.from(userConversations.keys())) {
    if (typeof k === "string" && k.endsWith(`:${key}`)) {
      userConversations.delete(k);
    }
  }
  for (const k of Array.from(conversationTimers.keys())) {
    if (typeof k === "string" && k.endsWith(`:${key}`)) {
      const t = conversationTimers.get(k);
      if (t) clearTimeout(t);
      conversationTimers.delete(k);
    }
  }
  for (const k of Array.from(conversationModes.keys())) {
    if (typeof k === "string" && k.endsWith(`:${key}`)) {
      conversationModes.delete(k);
    }
  }

  console.log(`🧹 Cleared conversation(s) for user ${key}`);
}

function clearConversationForKey(conversationKey) {
  const key = String(conversationKey);
  userConversations.delete(key);
  const timer = conversationTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    conversationTimers.delete(key);
  }
  conversationModes.delete(key);
  console.log(`🧹 Cleared conversation for key ${key}`);
}

/**
 * Reset conversation timeout for a user
 */
function resetConversationTimeout(userId) {
  const key = String(userId);
  // Clear existing timer
  const existingTimer = conversationTimers.get(key);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }
  
  // Set new timer
  const timer = setTimeout(() => {
    clearConversation(key);
  }, CONVERSATION_TIMEOUT);
  
  conversationTimers.set(key, timer);
}

let knowledgeCatalogCache = { at: 0, items: [] };

async function getKnowledgeCatalog() {
  const now = Date.now();
  if (now - knowledgeCatalogCache.at < 10 * 60 * 1000 && knowledgeCatalogCache.items.length > 0) {
    return knowledgeCatalogCache.items;
  }
  try {
    const all = await getAllBotKnowledge();
    const items = (all || []).map((entry) => ({
      key: entry.key || entry.id,
      title: entry.title || "",
      tags: Array.isArray(entry.tags) ? entry.tags : [],
    }));
    knowledgeCatalogCache = { at: now, items };
    return items;
  } catch (error) {
    console.error("Failed to load bot knowledge catalog:", error);
    return knowledgeCatalogCache.items;
  }
}

/**
 * Build the system prompt with context
 */
function buildSystemPrompt(message, knowledgeCatalog = []) {
  const serverName = message.guild?.name || 'Direct Message';
  const timestamp = new Date().toISOString();
  const catalogLines = knowledgeCatalog.length
    ? knowledgeCatalog
        .map((item) => `- ${item.key}: ${item.title}${item.tags?.length ? ` [${item.tags.join(", ")}]` : ""}`)
        .join("\n")
    : "- (none configured)";
  
  return `You are a helpful Discord bot assistant for Danish Zwift Racers (DZR), a cycling club focused on virtual racing in Zwift.

## Your Capabilities
You can help users with:
- Fetching rider statistics from Zwift/ZwiftPower (power data, race history, rankings)
- Comparing multiple riders' performance side by side
- Looking up and linking Zwift IDs to Discord accounts
- Searching for riders by name
- Finding event results
- Providing information about DZR teams and race series
- Answering questions using the admin-maintained knowledge base
- Determining Zwift Racing League (ZRL) category from rider watts + official limits via zrl_category
- Starting a Zwift route quiz (guess the route from the map shape) via start_quiz

## Important Rules
1. **ALWAYS use a tool call** when the user wants to take an action (fetch stats, link ID, search, ZRL category, etc.)
2. **Respond conversationally** only for greetings, clarifying questions, or general chat
3. When users mention Discord users with @ (like @Chris), **preserve the mention format** in your tool calls
4. If you're unsure what the user wants, **ask for clarification** rather than guessing
5. Before inventing answers about DZR teams or help topics, **check the knowledge base** or team data first
6. If a question needs two knowledge articles, call get_help_article once per topic and combine the results
7. **ZRL category questions** ("hvilken ZRL kategori/gruppe/division er jeg?", "kan jeg køre B?", etc.): ALWAYS call zrl_category. Do not answer from memory, and do not use only rider_stats or get_help_article for this. Use the tool's summary and numbers as-is — do not recalculate.

## Knowledge base
Available articles (use get_help_article with the key or a tag):
${catalogLines}

## Response Style
- Be friendly, helpful, and concise
- Use occasional Danish phrases since this is a Danish cycling club (e.g., "Godt træk!", "Kør stærkt!")
- When providing commentary about riders, be playful and use cycling metaphors
- Avoid overly technical jargon unless the user asks for details
- For ZRL answers: state Open/Women's category, whether Development is possible, and that the official category is set at the start line

## Current Context
- User: ${message.author.username} (ID: ${message.author.id})
- Server: ${serverName}
- Time: ${timestamp}`;
}

async function buildCoachSystemPrompt(message, userText) {
  const timestamp = new Date().toISOString();
  let memoryBlock = "No durable athlete constraints stored yet.";
  let pendingLine = "";
  let notesBlock = "None retrieved for this message.";
  try {
    const profile = await getCoachProfile(message.author.id);
    memoryBlock = formatCoachProfileForPrompt(profile);
    if (profile?.pendingConfirmation?.summary) {
      pendingLine = `\nLast save awaiting ja/nej: ${profile.pendingConfirmation.summary}`;
    }
  } catch (err) {
    console.error("getCoachProfile failed:", err?.message || err);
  }
  try {
    const notes = await listCoachChatNotes(message.author.id);
    const hits = retrieveRelevantNotes(notes, userText || "");
    const formatted = formatNotesForPrompt(hits);
    if (formatted) notesBlock = formatted;
  } catch (err) {
    console.error("listCoachChatNotes failed:", err?.message || err);
  }

  return `You are DZR Coach, a cycling coach for Danish Zwift Racers. You chat in a private Discord DM with one athlete.

## Data
You may only use tools to read THIS athlete's Strava data (the Discord user talking to you). Never request or invent another rider's activities.
Typical flow: get_recent_activities first, then get_activity_details for a specific session, plus profile/stats/zones as needed. get_zwiftpower_context is optional extra (category/phenotype).

## Athlete constraints (durable memory)
${memoryBlock}${pendingLine}

Obey ride frequency and weekly slots over last week's Strava volume. Never prescribe through an active injury.
If they ask to change or delete older memory, tell them to edit it on ${MY_PAGES_URL} (Profile tab). You may only undo the last auto-save with reject_athlete_memory when they say nej/forkert.

## Recent conversation notes (episodic, dated — not standing rules)
${notesBlock}

Treat these as hints for today's reply. A yesterday "felt ill" note matters today; a two-week-old tired note does not mean rest them now unless they bring it up. Do not copy these into update_athlete_memory.
If they ask to forget a chat note, tell them to delete it on ${MY_PAGES_URL} (Profile tab).
Use search_past_notes when they refer to something discussed earlier that is not in this block.

## Memory tools
- When the athlete states a durable fact (rides per week, other sports, fixed strength days, lasting injury, goal) OR a coaching-style preference (short messages, always Danish, direct tone, bullets only, etc.), call update_athlete_memory with only those fields.
- Transient state (illness, fatigue, mood, skip today, how a ride felt, one-off plans) is NOT durable memory. Do not call update_athlete_memory for those.
- Do not save a free-text notes field. Only the structured fields on the tool.
- Do not infer rules from a busy Strava week. Do not invent memory.
- Do not save language (da/en) just because this message is in Danish or English. Only save language if they explicitly want replies always in that language.
- After update_athlete_memory succeeds, include the tool's confirmMessageDa (or confirmMessageEn) verbatim as the memory notice. Do not replace it with a one-liner like "Gemte: ...". This notice is allowed even when they prefer short coaching replies. Ask only when something new was just stored.
- If they reply ja / det stemmer to a pending save, call confirm_athlete_memory.
- If they reply nej / forkert, call reject_athlete_memory (undoes only that last save).
- If they ignore the question, keep the save and do not ask again.

## Coaching style
- Reply in the user's language (Danish or English) unless Athlete constraints specify a language.
- Be a practical endurance coach: load, recovery, easy days, intensity distribution, race prep.
- Cite specific recent sessions (date, duration, power/HR) from tool results. Never invent numbers that were not returned by a tool.
- If tools fail, say so and ask them to reconnect Strava if needs_reconnect/connectUrl is present.
- Not medical advice. Do not prescribe training through illness, injury, chest pain, or disordered eating. Suggest seeing a professional when relevant.
- Do not give doping, extreme restriction, or dangerous overtraining advice.
- Keep replies concise (Discord) unless they asked for detailed replies. Use short bullets when listing sessions. If style.length is short, stay very brief.
- Never mention or invent Strava access tokens, refresh tokens, or Firestore documents.

## Current context
- Athlete Discord: ${message.author.username} (ID: ${message.author.id})
- Time: ${timestamp}`;
}

/**
 * Normalize OpenAI / SDK error fields (code may live on error or error.error)
 */
function getOpenAIErrorInfo(error) {
  const code = error?.code || error?.error?.code || null;
  const type = error?.type || error?.error?.type || null;
  const message = error?.message || error?.error?.message || "";
  const status = error?.status ?? error?.statusCode ?? null;
  const looksLikeQuota =
    code === "insufficient_quota" ||
    type === "insufficient_quota" ||
    /quota|billing|payment|exceeded your current quota/i.test(message);
  const looksLikeRateLimit =
    !looksLikeQuota &&
    (code === "rate_limit_exceeded" || status === 429);
  return { code, type, message, status, looksLikeQuota, looksLikeRateLimit };
}

function extractTokenUsage(response) {
  const u = response?.usage || {};
  const promptTokens = Number(u.prompt_tokens ?? u.input_tokens ?? 0) || 0;
  const completionTokens = Number(u.completion_tokens ?? u.output_tokens ?? 0) || 0;
  const totalTokens = Number(u.total_tokens ?? 0) || promptTokens + completionTokens;
  return { promptTokens, completionTokens, totalTokens };
}

function getMessageText(message) {
  const content = message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part.text === "string") return part.text;
        return "";
      })
      .join("")
      .trim();
  }
  return "";
}

function fallbackCoachFromTools(toolResults) {
  const withActivities = (toolResults || []).find((r) => Array.isArray(r.activities) && r.activities.length);
  if (withActivities) {
    const lines = withActivities.activities.slice(0, 12).map((a) => {
      const date = String(a.start_date || "").slice(0, 10) || "ukendt dato";
      const km = typeof a.distance_m === "number" ? `${(a.distance_m / 1000).toFixed(1)} km` : "";
      const min = typeof a.moving_time === "number" ? `${Math.round(a.moving_time / 60)} min` : "";
      const name = a.name || a.sport_type || "pas";
      return `• ${date} — ${name}${km ? `, ${km}` : ""}${min ? `, ${min}` : ""}`;
    });
    return (
      "Jeg hentede dine seneste Strava-pas, men selve coaching-teksten blev tom (modellen brugte tokens på reasoning). Her er ugen kort:\n\n" +
      lines.join("\n") +
      "\n\nSpørg gerne igen, fx *hvordan var i går?*"
    );
  }
  const failed = (toolResults || []).find((r) => r && r.success === false && r.message);
  if (failed?.needs_reconnect && failed.connectUrl) {
    return `🔗 Strava-forbindelsen skal fornys:\n${failed.connectUrl}`;
  }
  if (failed?.message) return String(failed.message).slice(0, 1500);
  return "Jeg hentede dine data, men kunne ikke skrive svaret færdigt. Prøv at spørge igen om lidt.";
}

function addTokenUsage(tally, response) {
  if (!tally) return;
  const u = extractTokenUsage(response);
  tally.promptTokens += u.promptTokens;
  tally.completionTokens += u.completionTokens;
  tally.totalTokens += u.totalTokens;
  tally.calls += 1;
}

async function flushCoachUsage(tally, message) {
  if (!tally || tally.calls <= 0) return;
  try {
    await recordCoachUsage({
      discordId: message.author.id,
      username: message.author.username,
      model: AI_CONFIG.model,
      promptTokens: tally.promptTokens,
      completionTokens: tally.completionTokens,
      totalTokens: tally.totalTokens,
      openaiCalls: tally.calls,
    });
  } catch (err) {
    console.error("flushCoachUsage failed:", err?.message || err);
  }
}

function lastAssistantText(conversation) {
  if (!Array.isArray(conversation)) return "";
  for (let i = conversation.length - 1; i >= 0; i--) {
    const msg = conversation[i];
    if (msg?.role === "assistant" && msg.content) return String(msg.content);
  }
  return "";
}

function scheduleCoachNoteExtract(args) {
  Promise.resolve()
    .then(() => extractCoachChatNotes(args))
    .catch((err) => console.error("extractCoachChatNotes failed:", err?.message || err));
}

async function extractCoachChatNotes({ discordId, username, userMessage, assistantText }) {
  if (!openai || shouldSkipExtract(userMessage) || !String(assistantText || "").trim()) return;
  let durableMemory = "";
  let recentNotes = [];
  try {
    const profile = await getCoachProfile(discordId);
    durableMemory = formatCoachProfileForPrompt(profile);
  } catch (err) {
    console.error("extract getCoachProfile failed:", err?.message || err);
  }
  try {
    recentNotes = await listCoachChatNotes(discordId);
  } catch (err) {
    console.error("extract listCoachChatNotes failed:", err?.message || err);
  }
  const now = new Date();
  const messages = buildExtractMessages({
    userMessage,
    assistantText,
    durableMemory,
    recentNotes,
    timestamp: now.toISOString(),
  });
  const response = await callOpenAIWithRetry(
    buildChatCompletionParams({
      messages,
      maxTokens: 400,
      reasoningEffort: "low",
    })
  );
  const usage = extractTokenUsage(response);
  if (usage.totalTokens > 0 || usage.promptTokens > 0) {
    try {
      await recordCoachUsage({
        discordId,
        username,
        model: AI_CONFIG.model,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        openaiCalls: 1,
      });
    } catch (err) {
      console.error("extract recordCoachUsage failed:", err?.message || err);
    }
  }
  const parsed = parseExtractedNotes(getMessageText(response.choices[0]?.message), now.toISOString());
  if (!parsed.length) return;
  await addCoachChatNotes(discordId, parsed, { at: now });
}

/**
 * Call OpenAI API with retry logic for transient rate limits (not quota/billing)
 */
async function callOpenAIWithRetry(params) {
  const { maxRetries, retryDelayMs } = AI_CONFIG;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await openai.chat.completions.create(params);
    } catch (error) {
      const info = getOpenAIErrorInfo(error);
      const isLastAttempt = attempt === maxRetries;
      
      // Only retry transient rate limits — quota/billing 429s will never succeed
      if (info.looksLikeRateLimit && !info.looksLikeQuota && !isLastAttempt) {
        const delay = retryDelayMs * Math.pow(2, attempt); // Exponential backoff
        console.log(`⏳ Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      
      throw error;
    }
  }
}

/**
 * Main handler for AI chat messages
 */
async function handleAIChatMessage(message, client) {
  // Check if OpenAI is configured
  if (!openai) {
    return; // Silently ignore if not configured
  }
  
  // Ignore bot messages
  if (message.author.bot) return;

  const isDM = message.channel.type === ChannelType.DM;

  // In guild channels: only respond when the bot is mentioned.
  // In DMs: treat every message as directed to the bot.
  if (!isDM) {
    const mentioned = message.mentions.users.has(client.user.id);
    const repliedToMe = await isReplyToBot(message, client);
    if (!mentioned && !repliedToMe) return;
  }
  
  try {
    let coachUsageTally = null;

    // Show typing indicator
    await message.channel.sendTyping();

    // Clean the message (remove only the bot mention, preserve user mentions)
    const botMentionPattern = new RegExp(`<@!?${client.user.id}>`, 'g');
    const cleanedMessage = message.content
      .replace(botMentionPattern, '') // Remove only bot mention
      .trim();

    if (!cleanedMessage) {
      await safeReply(message, "👋 Hej! I can help you with rider stats, team comparisons, and more. Just ask me something like:\n• Show me stats for @Chris\n• Compare @John, @Mike, and @Sarah\n• What's my Zwift ID?\n• Find riders named Anders");
      return;
    }

    // Coaching in guild channels always moves to a private DM.
    if (!isDM && isCoachingIntent(cleanedMessage)) {
      const result = await handoffCoachingFromMessage(message, client);
      if (result?.ok && result.dmChannelId) {
        markCoachingMode(message.author.id, result.dmChannelId);
      }
      return;
    }

    // Shortcut: "mine stats" → use caller's linked ZwiftID directly
    const normalized = cleanedMessage.toLowerCase().replace(/[!?\.]+$/g, '').trim();
    if (normalized === "mine stats" || normalized === "my stats") {
      const zwiftId = await getUserZwiftId(message.author.id);
      if (!zwiftId) {
        await safeReply(message,
          "❌ Du har endnu ikke linket et ZwiftID.\n\n" +
          "Svar på denne besked med dit ZwiftID (kun tal) eller de første 3+ bogstaver i dit Zwift-navn — så linker jeg det for dig.\n" +
          "(Alternativt: nævn mig igen i kanalen.)"
        );
        return;
      }

      try {
        const interaction = createSyntheticInteraction(message, {
          strings: { zwiftid: String(zwiftId) }
        });
        await handleRiderStats(interaction);
      } catch (err) {
        console.error("Error handling 'mine stats' shortcut:", err);
        await safeReply(message, "⚠️ Der opstod en fejl, da jeg forsøgte at hente dine stats. Prøv igen lidt senere eller brug `/rider_stats` med dit ZwiftID.");
      }
      return;
    }

    const conversationKey = getConversationKey(message);
    const wasCoach = conversationModes.get(conversationKey) === "coach";
    const isCoachSession = isDM && (isCoachingIntent(cleanedMessage) || wasCoach);

    if (isCoachSession) {
      const eligible = await strava.hasClubMemberRole(message.author.id, client, message.guild);
      if (!eligible) {
        conversationModes.delete(conversationKey);
        await safeReply(message, NOT_CLUB_MEMBER_TEXT);
        return;
      }
      if (!wasCoach) {
        userConversations.delete(conversationKey);
      }
      conversationModes.set(conversationKey, "coach");
      const connected = await strava.isStravaConnected(message.author.id);
      if (!connected) {
        const url = strava.getConnectUrl(message.author.id);
        await safeReply(
          message,
          "🔗 Forbind Strava først (linket gælder 15 min):\n" +
            (url || "Connect-link kunne ikke oprettes. Tjek STRAVA_CONNECT_SECRET.")
        );
        return;
      }
    }

    const knowledgeCatalog = isCoachSession ? [] : await getKnowledgeCatalog();
    const systemPrompt = isCoachSession
      ? await buildCoachSystemPrompt(message, cleanedMessage)
      : buildSystemPrompt(message, knowledgeCatalog);
    const activeTools = isCoachSession ? coachToolDefinitions : toolDefinitions;
    const maxTokens = isCoachSession ? COACH_MAX_TOKENS : AI_CONFIG.maxTokens;
    const maxIters = isCoachSession ? COACH_MAX_TOOL_ITERATIONS : MAX_TOOL_ITERATIONS;
    const replyFn = isCoachSession ? safeReplyChunks : safeReply;
    coachUsageTally = isCoachSession
      ? { promptTokens: 0, completionTokens: 0, totalTokens: 0, calls: 0 }
      : null;
    const callAndTrack = async (params) => {
      const response = await callOpenAIWithRetry(params);
      if (coachUsageTally) addTokenUsage(coachUsageTally, response);
      return response;
    };
    
    // Get or create conversation history
    let conversation = userConversations.get(conversationKey);

    if (!conversation) {
      conversation = [
        {
          role: "system",
          content: systemPrompt
        }
      ];
    } else {
      conversation[0] = {
        role: "system",
        content: systemPrompt
      };
    }
    
    // Add user message to conversation
    conversation.push({
      role: "user",
      content: cleanedMessage
    });
    
    // Trim conversation if too long (keep system message)
    if (conversation.length > MAX_CONVERSATION_LENGTH + 1) {
      conversation = [
        conversation[0], // Keep system message
        ...conversation.slice(-(MAX_CONVERSATION_LENGTH))
      ];
    }
    
    // Call OpenAI with retry logic
    const response = await callAndTrack(
      buildChatCompletionParams({
        messages: conversation,
        tools: activeTools,
        toolChoice: "auto",
        maxTokens,
        reasoningEffort: isCoachSession ? COACH_REASONING_EFFORT : undefined,
      })
    );
    
    const responseMessage = response.choices[0].message;
    
    // Check if the model wants to call tools
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      // Add assistant's message with tool calls to conversation
      conversation.push({
        role: "assistant",
        content: responseMessage.content || null,
        tool_calls: responseMessage.tool_calls
      });

      // Tool calling loop: execute tools, append results, then let the model produce a user-facing answer.
      // (Bounded to avoid infinite tool loops.)
      let currentToolCalls = responseMessage.tool_calls;
      let toolResults = [];
      let iteration = 0;

      while (currentToolCalls && currentToolCalls.length > 0 && iteration < maxIters) {
        // Execute all tool calls (parallel if multiple)
        toolResults = await executeToolCalls(currentToolCalls, message);

        // Add tool results to conversation (compact to reduce context bloat)
        for (const result of toolResults) {
          conversation.push({
            role: "tool",
            tool_call_id: result.tool_call_id,
            content: safeStringify(compactToolResult(result))
          });
        }

        // If the tools already handled user-visible output, don't force an extra LLM "result summary".
        // Exception: we still do the playful stats commentary below.
        const shouldSkipGenericAnswer = currentToolCalls.every(tc => TOOLS_THAT_REPLY_DIRECTLY.has(tc.function.name));

        // Check if we should generate a follow-up commentary for stats
        const hasStatsCall = currentToolCalls.some(
          tc => tc.function.name === "rider_stats" || tc.function.name === "team_stats"
        );
        const allSuccessful = toolResults.every(r => r.success);

        if (hasStatsCall && allSuccessful && shouldSkipGenericAnswer) {
          // Trim conversation before follow-up
          if (conversation.length > MAX_CONVERSATION_LENGTH + 1) {
            conversation = [
              conversation[0],
              ...conversation.slice(-(MAX_CONVERSATION_LENGTH))
            ];
          }

          try {
            const isTeamStats = currentToolCalls.some(tc => tc.function.name === "team_stats");
            const prompt = isTeamStats
              ? "Give a playful 1-3 sentence commentary comparing these riders. Use a light lyrical or pop-culture vibe if it fits, and feel free to exaggerate for humor. Do not include raw numbers or W/kg, and avoid bullet points or lists."
              : "Give a playful 1-3 sentence commentary about the rider. Use a light lyrical or pop-culture vibe if it fits, and feel free to exaggerate for humor. Do not include raw numbers or W/kg, and avoid bullet points or lists.";

            const followUpMessages = [
              ...conversation,
              { role: "user", content: prompt }
            ];

            const followUp = await callAndTrack(
              buildChatCompletionParams({
                messages: followUpMessages,
                maxTokens: 300,
                temperature: 1.0, // Higher creativity on models that support sampling
              })
            );

            const followUpMessage = followUp.choices[0]?.message;

            if (followUpMessage?.content && followUpMessage.content.trim().length > 0) {
              conversation.push({
                role: "assistant",
                content: followUpMessage.content
              });

              await safeReply(message, followUpMessage.content);
            } else {
              // Fallback to heuristic commentary
              const statsResult = toolResults.find(r => r.rider || r.team);
              if (statsResult?.rider) {
                const fallback = buildRiderComment(statsResult.rider);
                if (fallback) {
                  conversation.push({ role: "assistant", content: fallback });
                  await safeReply(message, fallback);
                }
              } else if (statsResult?.team) {
                const fallback = buildTeamComment(statsResult.team);
                if (fallback) {
                  conversation.push({ role: "assistant", content: fallback });
                  await safeReply(message, fallback);
                }
              }
            }
          } catch (followUpError) {
            console.error("Error generating follow-up AI response:", followUpError);
            // Fallback to heuristic commentary
            const statsResult = toolResults.find(r => r.rider || r.team);
            if (statsResult?.rider) {
              const fallback = buildRiderComment(statsResult.rider);
              if (fallback) {
                conversation.push({ role: "assistant", content: fallback });
                await safeReply(message, fallback);
              }
            } else if (statsResult?.team) {
              const fallback = buildTeamComment(statsResult.team);
              if (fallback) {
                conversation.push({ role: "assistant", content: fallback });
                await safeReply(message, fallback);
              }
            }
          }
        }

        // Generic answer step: turn tool results into a natural-language reply when tools didn't already reply.
        if (!shouldSkipGenericAnswer) {
          // Trim before asking again
          if (conversation.length > MAX_CONVERSATION_LENGTH + 1) {
            conversation = [
              conversation[0],
              ...conversation.slice(-(MAX_CONVERSATION_LENGTH))
            ];
          }

          const postTool = await callAndTrack(
            buildChatCompletionParams({
              messages: conversation,
              tools: activeTools,
              toolChoice: "auto",
              maxTokens,
              reasoningEffort: isCoachSession ? COACH_REASONING_EFFORT : undefined,
            })
          );

          const postToolMsg = postTool.choices[0]?.message;
          if (!postToolMsg) break;

          console.log("🤖 Post-tool model reply", {
            finish_reason: postTool.choices[0]?.finish_reason,
            contentLen: getMessageText(postToolMsg).length,
            toolCalls: postToolMsg.tool_calls?.length || 0,
            usage: postTool.usage,
          });

          // If the model wants to call more tools, continue the loop — but only if we can
          // actually execute them within maxIters. Otherwise we'd push an assistant
          // message with unresolved tool_calls into history, which OpenAI rejects on the next turn.
          if (postToolMsg.tool_calls && postToolMsg.tool_calls.length > 0 && iteration + 1 < maxIters) {
            conversation.push({
              role: "assistant",
              content: postToolMsg.content || null,
              tool_calls: postToolMsg.tool_calls
            });
            currentToolCalls = postToolMsg.tool_calls;
            iteration++;
            continue;
          }

          let text = getMessageText(postToolMsg);

          // gpt-5 can spend the whole completion budget on reasoning and return empty content.
          if (!text && isCoachSession) {
            const retry = await callAndTrack(
              buildChatCompletionParams({
                messages: [
                  ...conversation,
                  {
                    role: "user",
                    content: "Skriv nu coaching-svaret til atleten ud fra tool-resultaterne. Ingen flere tool calls. Kort og konkret.",
                  },
                ],
                maxTokens: COACH_MAX_TOKENS,
                reasoningEffort: COACH_REASONING_EFFORT,
              })
            );
            text = getMessageText(retry.choices[0]?.message);
          }

          if (text) {
            conversation.push({ role: "assistant", content: text });
            await replyFn(message, text);
          } else if (isCoachSession) {
            const fallback = fallbackCoachFromTools(toolResults);
            conversation.push({ role: "assistant", content: fallback });
            await replyFn(message, fallback);
          } else if (postToolMsg.tool_calls && postToolMsg.tool_calls.length > 0) {
            // Hit the iteration cap and the model only offered more tool calls, no text.
            await safeReply(message, "⚠️ I wasn't able to finish that request after a few tool calls. Please try rephrasing or breaking it into a simpler question.");
          }
        }

        break; // Done with tools for this message
      }
    } else {
      // Model responded conversationally (no tool calls)
      let text = getMessageText(responseMessage);
      if (!text && isCoachSession) {
        text = "Jeg er klar som DZR Coach, men fik et tomt modelsvar. Prøv at spørge igen, fx *Hvordan var min uge?*";
      }
      conversation.push({
        role: "assistant",
        content: text
      });
      
      if (text) {
        await replyFn(message, text);
      }
    }
    
    // Trim conversation if it has grown too long after processing
    if (conversation.length > MAX_CONVERSATION_LENGTH + 1) {
      conversation = [
        conversation[0],
        ...conversation.slice(-(MAX_CONVERSATION_LENGTH))
      ];
    }

    // Save updated conversation
    userConversations.set(conversationKey, conversation);
    
    // Reset timeout
    resetConversationTimeout(conversationKey);

    if (isCoachSession) {
      scheduleCoachNoteExtract({
        discordId: message.author.id,
        username: message.author.username,
        userMessage: cleanedMessage,
        assistantText: lastAssistantText(conversation),
      });
    }

    await flushCoachUsage(coachUsageTally, message);
    
  } catch (error) {
    const info = getOpenAIErrorInfo(error);
    console.error("Error in AI chat handler:", {
      status: info.status,
      code: info.code,
      type: info.type,
      message: info.message,
      raw: error,
    });
    
    if (info.looksLikeQuota) {
      await safeReply(message, "⚠️ OpenAI API quota/billing issue. Check platform.openai.com billing and credits, then restart the bot.");
    } else if (info.code === "invalid_api_key" || info.status === 401) {
      await safeReply(message, "⚠️ OpenAI API key is invalid or missing. Update OPENAI_API_KEY in the host env (e.g. Render) and restart.");
    } else if (info.looksLikeRateLimit) {
      await safeReply(message, "⚠️ Too many requests to OpenAI. Please wait a moment and try again.");
    } else {
      await safeReply(message, "⚠️ An error occurred while processing your message. Please try again.");
    }
    await flushCoachUsage(coachUsageTally, message);
  }
}

module.exports = {
  handleAIChatMessage,
  clearConversation, // Export for testing/admin commands
  markCoachingMode,
  AI_CONFIG // Export for external configuration if needed
};
