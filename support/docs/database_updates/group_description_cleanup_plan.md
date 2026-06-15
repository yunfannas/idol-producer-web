## Group Description Cleanup Plan

Current decision:
- Keep the broader strip of bad `groups.json` description blobs.
- Treat long scraped infobox text dumps as worse than empty descriptions.

What was done:
- `database/groups.json` had infobox-style description dumps removed in bulk.
- This includes HEROINES-family groups and unrelated groups that were carrying the same bad scrape artifact pattern.

Why:
- The stored text was often truncated, noisy, and misleading.
- Empty descriptions are a safer baseline than low-quality scraped garbage.

Future pass:
- Revisit groups one by one and write short clean descriptions.
- Prefer concise summaries over copied infobox text.
- Prioritize:
  1. playable / scenario-relevant groups
  2. high-popularity groups
  3. agency / union clusters that appear often in gameplay

Guidelines for the rewrite pass:
- One to three sentences max.
- Focus on identity, origin, style/concept, and notable context if reliable.
- Do not store raw `Information / Current Members / Former Members / Associated Acts` scrape text as description.
- If no clean summary is available yet, leave `description` empty.
