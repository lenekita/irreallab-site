IRREALLAB — REELS UPDATE

What changed:
- New page: reels.html
- New simple data file: reels.json
- Homepage nav “Reels” now opens reels.html
- Sitemap now includes reels.html

How Radu can add a new Instagram reel without touching the layout:
1. Open reels.json in GitHub.
2. Click the pencil icon.
3. Copy one existing block, paste it under the last one, and change only:
   - title
   - url
   - hashtags
4. Click Commit changes.

Important:
- Every block must be separated by a comma except the last block.
- The URL should be the Instagram Reel URL, for example:
  https://www.instagram.com/reel/XXXXXXXXXXX/

Best future no-code solution:
Connect reels.html to a Google Sheet, Airtable, or Decap CMS so Radu edits a form/table instead of any file. For GitHub Pages, the cleanest simple option is a public Google Sheet published as CSV/JSON and fetched by the page.
