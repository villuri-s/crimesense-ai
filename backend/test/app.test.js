import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app.js';

test('createApp exposes an express app', () => {
  const app = createApp();
  assert.equal(typeof app.listen, 'function');
});
