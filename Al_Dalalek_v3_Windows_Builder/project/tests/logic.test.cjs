// Run with: npm run test:logic (requires the project's dev dependencies).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function getExports(name) {
  const file = path.join(__dirname, '..', 'src', 'lib', name);
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const sandbox = { exports: {}, localStorage: { getItem: () => null, setItem() {} }, window: { dispatchEvent() {} }, Event: class {} };
  vm.runInNewContext(js, sandbox, { filename: name });
  return sandbox.exports;
}
const { alertsForWarehouse } = getExports('stock-alerts.ts');
const { toBaseQuantity, voucherRows, previewHistoricalNumbers } = getExports('voucher-utils.ts');
const items = [
  { id: 'a', name: 'A', code: 'A', unit: 'قطعة', reorder_level: 10 },
  { id: 'b', name: 'B', code: 'B', unit: 'شدة', reorder_level: 5 },
  { id: 'c', name: 'C', code: 'C', unit: 'قطعة', reorder_level: 0 },
];
const balances = [
  { item_id: 'a', warehouse_id: 'w1', balance: 8 },
  { item_id: 'a', warehouse_id: 'w2', balance: 99 },
  { item_id: 'b', warehouse_id: 'w2', balance: 7 },
];
test('alerts use selected warehouse only, and report zero-stock items', () => {
  const alerts = alertsForWarehouse(items, balances, 'w1');
  assert.deepEqual(Array.from(alerts, (r) => [r.item_id, r.total_balance]), [['b', 0], ['a', 8]]);
  assert.equal(alertsForWarehouse(items, balances, '').length, 0);
});
test('item minimum 0 disables alert for item only', () => {
  assert.ok(!alertsForWarehouse(items, balances, 'w1').some((r) => r.item_id === 'c'));
});
test('base quantity conversion is once-only and rejects excessive precision', () => {
  assert.equal(toBaseQuantity(3, 12), 36);
  assert.throws(() => toBaseQuantity(1, 0.0001));
  assert.throws(() => toBaseQuantity(-1, 1));
});
test('voucher grouping does not mix same number on different dates', () => {
  const rows = [
    { id: 'one', transaction_type: 'receipt', transaction_number: 'A1', date: '2026-01-01', created_at: '2026-01-01T10:00:00' },
    { id: 'two', transaction_type: 'receipt', transaction_number: 'A1', date: '2026-01-01', created_at: '2026-01-01T10:01:00' },
    { id: 'other', transaction_type: 'receipt', transaction_number: 'A1', date: '2025-01-01', created_at: '2025-01-01T10:00:00' },
  ];
  assert.equal(voucherRows(rows, { id: 'one' }).length, 2);
  assert.equal(previewHistoricalNumbers(rows).length, 2);
});
