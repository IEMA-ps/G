import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const h=readFileSync(new URL('./index.html',import.meta.url),'utf8');
assert.match(h,/telegram-notify\.js\?v=tg-5/);
assert.equal((h.match(/syncReminder\(/g)||[]).length,4,'def + create + cancel + status');
assert.match(h,/if\(!remindersOn\(\)\|\|!bk\) return/);
assert.match(h,/reminderPrefs\(mid,\{\[k\]:on\}\)/);
console.log('reminder wiring ok');
