// Static checks on index.html head: pinch zoom allowed, Font Awesome pinned with SRI.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const h=readFileSync(new URL('./index.html',import.meta.url),'utf8').slice(0,6000);
const vp=h.match(/<meta name="viewport"[^>]*>/)[0];
assert.ok(!/user-scalable\s*=\s*no/i.test(vp),'zoom must not be disabled');
assert.ok(!/maximum-scale\s*=\s*1(\.0)?\b/.test(vp),'maximum-scale=1 must not be set');
const fa=h.match(/<link[^>]*font-awesome[^>]*>/)[0];
assert.match(fa,/integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl\+Vegovlnee1c9QX4TctnWMn13TZye\+giMm8e2LwA=="/);
assert.match(fa,/crossorigin="anonymous"/);
console.log('page-head: 4 checks passed');
