// The pages load style.css with a version tag so a phone never mixes new code with an old stylesheet.
// The tag must match the offline copy the service worker keeps, or the offline page loses its styles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`../public/${f}`, import.meta.url), 'utf8');

test('style.css version tag is the same in the pages and the service worker', () => {
  const sw = read('sw.js');
  const cache = /choir-app-v(\d+)/.exec(sw)[1];
  assert.match(sw, new RegExp(`'/style\\.css\\?v=${cache}'`));
  for (const page of ['index.html', 'teacher.html']) assert.match(read(page), new RegExp(`href="style\\.css\\?v=${cache}"`), page);
});
