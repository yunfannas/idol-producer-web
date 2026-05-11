# Manual Profile Gap Guide

Use the CSV files in this folder to paste source links while filling missing idol metadata.

## Files
- `manual_profile_gap_checklist.csv`: every idol still missing birthday, birthplace, height, or portrait
- `manual_birthday_gaps.csv`: only idols missing birthday
- `manual_birthplace_gaps.csv`: only idols missing birthplace
- `manual_height_gaps.csv`: only idols missing height
- `manual_portrait_gaps.csv`: only idols missing portrait

## Suggested workflow
1. Open the CSV that matches the field you want to work on.
2. Use `recommended_source` first.
3. Run the `recommended_search_query` in your browser.
4. Paste the page URL into `manual_resource_link`.
5. Use `manual_notes` for the exact value you found or any ambiguity.

## Birthday rules
- Use `birthday` only when the full year-month-day is public.
- Use `birthday_partial` when only month and day are public, in `MM-DD` format.
- If `birthday_partial` is filled, the idol should not stay in the birthday-missing list.
- Keep `age` empty when the birth year is not public.

## How to find each field
- Birthday: use the profile infobox date-of-birth field.
- Birthplace: use the profile infobox birthplace or origin field.
- Height: use the profile infobox height field and record the numeric cm value.
- Portrait: prefer a clear member profile image from an official page or fandom infobox.

## Source priority
- AKB-family groups: `akb48.fandom.com` first, then official profile pages.
- Other indie or idol groups: `jpop.fandom.com` first.
- Sakamichi groups: official profile pages first, then fandom pages if available.
- If a row already has `wikipedia_url_ja`, check that page before searching from scratch.

## Notes
- Keep one source link per row in `manual_resource_link`.
- If birthday, birthplace, and height all come from the same page, reuse that link.
- For partial birthdays, write the month-day in `manual_notes` if you have not imported it yet.
- For portraits, note if the image is official, fandom, or Wikipedia in `manual_notes`.
