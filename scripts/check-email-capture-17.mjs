import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const path=resolve(process.env.EMAIL_CAPTURE_PATH||'demo/email-capture.jsonl');
const messages=(await readFile(path,'utf8')).trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
const expected=['Assigned','Submitted for review','Returned','Submitted for review','Signed off','Meeting action assigned'];
assert.equal(messages.length,expected.length,`Expected six demo-story emails, got ${messages.length}`);
for(const [index,message] of messages.entries()){
  assert.equal(message.to,'<team-inbox@example.invalid>');
  assert.match(message.raw,new RegExp(expected[index].replaceAll(' ','[\\s ]+'),'i'));
  assert.match(message.raw,/Open task: https:\/\/localhost\/\?task=(?:=3D)?\d+/);
  assert.match(message.raw,/Project: Engine Development Programme/);
  assert.match(message.raw,/By: (R\. Sharma|A\. Iyer|S\. Nair)/);
}
assert.match(messages[2].raw,/Please correct the valve timing assumptions and resubmit/);
assert.match(messages[5].raw,/Meeting: Valve train review/);
console.log('Email #17 passed: six demo-story messages to the team inbox with actor, reason, meeting, and task links.');
