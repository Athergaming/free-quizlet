# Flipside

A free flashcard study app. No logins, no sign-ups, no server: your sets live in your browser.

## What it does

- **Flashcards**: flip, shuffle, star, read aloud, and an optional "know it / still learning" pass.
- **Learn**: short rounds. Each card is asked as multiple choice, then as a written answer. Two right answers master it; misses come back.
- **Test**: a graded practice exam mixing true/false, multiple choice, matching and written questions.
- **Match**: pair terms with definitions against the clock, with a personal best per set.
- **Import** from a Quizlet link, pasted text, or a JSON/CSV/TSV/text file.
- **Share** a set as a link. The cards are packed into the link itself, so nothing is uploaded.
- Light and dark themes, keyboard shortcuts, works on phones.

## Run it

It is a static site with no build step and no dependencies.

```bash
npm start
```

Then open http://localhost:5173. Any static file server works too. Opening `index.html` straight from disk does not, because browsers block JavaScript modules on `file://`.

To put it online with GitHub Pages: repository **Settings → Pages → Deploy from a branch**, pick the branch and `/ (root)`.

## Importing from Quizlet

A website is not allowed to read another website's pages, so Flipside cannot fetch a set from a link on its own. There are two routes:

1. **Bookmark (desktop).** On the Import page, paste the set's link and follow the three steps: drag the "Send to Flipside" button to your bookmarks bar once, open the set, click the bookmark. It reads the cards from the page you are looking at and opens Flipside with them ready to save.
2. **Export text (works everywhere).** On the set's page use its Export option, copy the text, and paste it into Import → Paste text.

The bookmark only sees what the page shows you. If a set is cut short for logged-out visitors, you get the visible cards only. It depends on how the set page is built, so if that changes the bookmark may need updating; the paste route does not have that problem.

## Your data

Everything is stored in this browser's `localStorage`. Clearing site data removes your sets, and they do not sync between devices. Use a set's **⋯ → Download as JSON** to back it up or move it.

## Development

```bash
npm test
```

runs the unit tests for parsing, grading, share links and the bookmark's card reader.

```
index.html        page shell
css/styles.css    all styles
js/app.js         router and theme
js/store.js       localStorage data
js/lib/           parsing, grading, share links, bookmarklet (no DOM, unit tested)
js/views/         one file per page and study mode
```
