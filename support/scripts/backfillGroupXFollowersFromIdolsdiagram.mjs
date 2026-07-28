#!/usr/bin/env node
/**
 * DEPRECATED.
 *
 * Do not mirror idolsdiagram Spotify fans into `x_followers`.
 * Use instead:
 *   node support/scripts/separateGroupFansAndXFollowers.mjs
 *
 * That script keeps `fans` as Spotify and sets `x_followers` from member X sums.
 */
console.error(
  "DEPRECATED: backfillGroupXFollowersFromIdolsdiagram.mjs wrongly mirrored Spotify fans into x_followers.\n" +
    "Run: node support/scripts/separateGroupFansAndXFollowers.mjs",
);
process.exit(1);
