// UAT-OP-3 P1-A — LOADING must never render as a data-integrity failure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardStatus } from '../lib/dashboardStatus.ts';

test('loading (no kpi yet) -> loading, NOT integrity', () => {
  assert.equal(dashboardStatus({ loading: true, hasKpi: false, loadFailed: false, reconOk: false }), 'loading');
});

test('loading with a genuine reconOk=false still shows loading, not integrity (no flash)', () => {
  // reconcileOperatorKpi(null) returns ok:false; while loading this must not flash a warning
  assert.equal(dashboardStatus({ loading: true, hasKpi: false, loadFailed: false, reconOk: false }), 'loading');
});

test('loaded but no kpi -> unavailable (honest, not a false zero)', () => {
  assert.equal(dashboardStatus({ loading: false, hasKpi: false, loadFailed: true, reconOk: false }), 'unavailable');
});

test('loaded with kpi and failing checks -> integrity (a REAL discrepancy still shows)', () => {
  assert.equal(dashboardStatus({ loading: false, hasKpi: true, loadFailed: false, reconOk: false }), 'integrity');
});

test('loaded with kpi and passing checks -> healthy', () => {
  assert.equal(dashboardStatus({ loading: false, hasKpi: true, loadFailed: false, reconOk: true }), 'healthy');
});

test('a late refresh (loading=true) over existing kpi keeps healthy/integrity, never flashes loading badge', () => {
  // hasKpi true during a refresh -> not the loading state (skeleton only shows when no kpi)
  assert.equal(dashboardStatus({ loading: true, hasKpi: true, loadFailed: false, reconOk: true }), 'healthy');
});
