import test from 'node:test';
import assert from 'node:assert/strict';
import {publicPayload} from './public-content.mjs';

test('public serializer excludes unknown and inherited object-property record kinds',()=>{
  for(const kind of ['request','submission','constructor','toString','__proto__','hasOwnProperty']) {
    assert.equal(publicPayload({id:'private-fixture',kind,title:'Private title',body:'Private body',payload:{secret:'private-sentinel'}}),null,kind);
  }
});
