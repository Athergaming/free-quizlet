// The "Send to Flipside" bookmarklet.
//
// A static site cannot read another site's pages (browsers block it), so the import runs
// from inside the set page itself: the user clicks the bookmark while viewing a set, the
// function below reads the cards that page already loaded, and hands them back in the URL.
//
// `collect` is serialised with toString(), so it must stay self-contained: ES5 only, no
// references to anything outside its own body.

export function collect(doc) {
  var cards = [];
  var seen = {};

  function push(term, def) {
    term = String(term == null ? '' : term).trim();
    def = String(def == null ? '' : def).trim();
    if (!term && !def) return;
    var key = term + '\u0000' + def;
    if (seen[key]) return;
    seen[key] = 1;
    cards.push([term, def]);
  }

  function sideText(side) {
    var out = [];
    var media = (side && side.media) || [];
    for (var i = 0; i < media.length; i++) {
      if (media[i] && typeof media[i].plainText === 'string' && media[i].plainText) {
        out.push(media[i].plainText);
      }
    }
    return out.join(' ');
  }

  // Walk embedded page data looking for anything shaped like a flashcard.
  function walk(node, depth) {
    if (node == null || depth > 16) return;
    if (typeof node === 'string') {
      var first = node.charAt(0);
      if (node.length > 20 && (first === '{' || first === '[')) {
        try {
          walk(JSON.parse(node), depth + 1);
        } catch (e) {}
      }
      return;
    }
    if (typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (var i = 0; i < node.length; i++) walk(node[i], depth + 1);
      return;
    }
    if (Array.isArray(node.cardSides) && node.cardSides.length >= 2) {
      var word = '';
      var def = '';
      for (var s = 0; s < node.cardSides.length; s++) {
        var side = node.cardSides[s];
        if (side && side.label === 'word') word = sideText(side);
        else if (side && side.label === 'definition') def = sideText(side);
      }
      if (!word && !def) {
        word = sideText(node.cardSides[0]);
        def = sideText(node.cardSides[1]);
      }
      push(word, def);
      return;
    }
    if (typeof node.word === 'string' && typeof node.definition === 'string') {
      push(node.word, node.definition);
      return;
    }
    for (var k in node) {
      if (Object.prototype.hasOwnProperty.call(node, k)) walk(node[k], depth + 1);
    }
  }

  var scripts = doc.querySelectorAll('script#__NEXT_DATA__, script[type="application/json"]');
  for (var i = 0; i < scripts.length; i++) {
    try {
      walk(JSON.parse(scripts[i].textContent), 0);
    } catch (e) {}
  }

  // Fall back to the cards visible on the page.
  function text(el) {
    return el.innerText || el.textContent || '';
  }
  if (!cards.length) {
    var rows = doc.querySelectorAll('.SetPageTerms-term, [class*="SetPageTerm-content"]');
    for (var r = 0; r < rows.length; r++) {
      var sides = rows[r].querySelectorAll('.TermText, [class*="TermText"]');
      if (sides.length >= 2) push(text(sides[0]), text(sides[1]));
    }
  }
  if (!cards.length) {
    var all = doc.querySelectorAll('.TermText, [class*="TermText"]');
    for (var t = 0; t + 1 < all.length; t += 2) push(text(all[t]), text(all[t + 1]));
  }

  var h1 = doc.querySelector('h1');
  var title = String((h1 && h1.textContent) || doc.title || 'Imported set')
    .replace(/\s*\|\s*Quizlet\s*$/i, '')
    .replace(/\s+Flashcards\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  return { title: title, url: doc.location ? String(doc.location.href) : '', cards: cards };
}

/** Build the javascript: URL for the bookmark, pointing back at this copy of the app. */
export function bookmarkletHref(appUrl) {
  const code = `(function(){var collect=${collect.toString()};try{var r=collect(document);if(!r.cards.length){alert("Flipside could not find any flashcards on this page.\\n\\nOpen the set itself, scroll so all its cards have loaded, and try again. Or use the set's Export option and paste the text into Flipside.");return;}var u=${JSON.stringify(appUrl)}+"#/import?data="+encodeURIComponent(JSON.stringify({t:r.title,u:r.url,c:r.cards}));var w=window.open(u,"_blank");if(!w)location.href=u;}catch(e){alert("Flipside import failed: "+e.message);}})();`;
  return 'javascript:' + encodeURIComponent(code);
}
