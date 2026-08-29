---
name: public-apis
description: >
 Use when the user needs a free or public API for something and does not
 already know which one - "is there an API for X", "find me a weather API",
 "something for currency conversion", "a free API that needs no key",
 "what can I use to look up company data".

 Searches a local snapshot of the public-apis catalogue: 1705 APIs across 51
 categories, each with its auth type, HTTPS support and CORS status. Answers
 offline, with no fetch and no API key.

 NOT for: reading the docs of an API the user already named (fetch those
 directly); calling an API; anything about private or internal APIs.
---

# public-apis - find a free API for a given need

A local snapshot of [public-apis/public-apis](https://github.com/public-apis/public-apis)
(MIT), flattened from its README into one greppable TSV.

**Never read `references/apis.tsv` in full - it is 1705 rows.** Grep it.

## The data

`references/apis.tsv`, tab-separated, one header row, seven columns:

| Column | Meaning |
|---|---|
| `name` | API name |
| `category` | one of the 51 below |
| `auth` | `None`, `apiKey`, `OAuth`, `X-Mashape-Key`, `User-Agent` |
| `https` | `Yes` / `No` / `Unknown` |
| `cors` | `Yes` / `No` / `Unknown` - `Yes` means callable from browser JS |
| `url` | docs or signup page |
| `description` | one line |

`auth` is the column that usually matters: **`None` means no key, no signup,
no account** - 799 of the 1705 qualify. Lead with those unless the user has
said they don't mind registering.

## How to search

Case-insensitive keyword across **name and description only** - match those two
fields, not the whole line, or the category column bleeds in (searching
`currency` against the line returns every Cryptocurrency entry):

```bash
awk -F'\t' 'tolower($1 $7) ~ /weather/' references/apis.tsv | cut -f1,3,5,6,7
```

Plain `grep -i weather` over the file is fine when the word is not also part of
a category name, but the awk form is the one to reach for by default.

No-key APIs only, in one category:

```bash
awk -F'\t' '$2=="Weather" && $3=="None"' references/apis.tsv | cut -f1,6,7
```

Browser-callable and no key - the strictest useful filter, for front-end work:

```bash
awk -F'\t' '$3=="None" && $5=="Yes"' references/apis.tsv | cut -f1,2,7
```

What a category holds:

```bash
awk -F'\t' '$2=="Finance"' references/apis.tsv | cut -f1,3,7
```

On Windows PowerShell, `Import-Csv -Delimiter "\`t"` works if grep is absent,
but Git Bash is simpler.

## Categories

Development (150), Government (103), Games & Comics (101), Geocoding (95),
Cryptocurrency (78), Transportation (77), Finance (63), Open Data (52),
Social (51), Video (48), Sports & Fitness (47), Security (46),
Science & Math (40), Weather (38), Documents & Productivity (38), Health (37),
Machine Learning (35), Music (34), Photography (31), Business (30),
Test Data (29), Food & Drink (26), Animals (26), Personality (25), Books (25),
Email (24), Art & Design (24), News (23), Jobs (23), Currency Exchange (21),
URL Shorteners (20), Environment (20), Text Analysis (19), Anime (19),
Shopping (18), Cloud Storage & File Sharing (18), Calendar (18),
Entertainment (17), Anti-Malware (16), Blockchain (15), Dictionaries (13),
Tracking (11), Vehicle (10), Data Validation (10), Open Source Projects (9),
Phone (7), Authentication & Authorization (7), Continuous Integration (6),
Programming (5), Patent (4), Events (3)

Keyword search usually beats guessing the category - an API for company data
sits under Business, but one for company *filings* sits under Government.

## Answering well

Give two or three candidates, not twenty. For each: name, what it does, whether
it needs a key, and the URL. Say plainly when the best fit needs a key and the
key-free options are weaker - that trade-off is usually the actual decision.

State that this is a community catalogue snapshot, not a live health check.
Entries go stale: an API here may have added auth, started charging, or shut
down. The listed URL is the thing to verify, and it is worth saying so rather
than implying the entry is current. If the user needs certainty, fetch the
`url` and check before they build against it.

## Refreshing

Upstream changes weekly. To pull the current catalogue:

```bash
python scripts/refresh.py # fetch and rewrite apis.tsv
python scripts/refresh.py --check # report drift, write nothing
```

Output is pure ASCII by design (accents NFKD-folded) so the file survives
transfer through a non-UTF-8 console without silent corruption. The script
exits non-zero if it parses zero entries, which is the signal that upstream
changed its table format rather than that the catalogue emptied.
