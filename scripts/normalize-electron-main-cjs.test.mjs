import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeElectronMainCjsSource, findElectronMainCjsEsmSyntax } from './normalize-electron-main-cjs.mjs';
test('preserves valid CJS with embedded generated projects and regex literals', () => {
  const source = 'const re = /`/;\nconst project = `export default function Project() {}\nimport x from "y";`;\nmodule.exports = project;';
  assert.deepEqual(normalizeElectronMainCjsSource(source), { source, changed: false });
  assert.deepEqual(findElectronMainCjsEsmSyntax(source), []);
});
test('continues to detect and repair a legacy static ESM import', () => {
  const source = 'import fs from "node:fs";';
  assert.equal(findElectronMainCjsEsmSyntax(source).length, 1);
  assert.match(normalizeElectronMainCjsSource(source).source, /require\("node:fs"\)/);
});
