# Universities by country

One JSON file per ISO 3166-1 alpha-2 country code (`KE.json`, `NG.json`, ...), each a sorted array of names.
`index.json` maps country code to the number of universities.

Generated from [Hipo/university-domains-list](https://github.com/Hipo/university-domains-list)
(MIT licence, see `LICENSE.txt`). Kenyan medical schools also have a curated list with programme
details in `data.js` (`UNIVERSITIES`), which is shown first for Kenya.

Regenerate with: `node scripts/universities.mjs`
