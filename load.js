import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL    = __ENV.BASE_URL    || 'http://localhost:8080';
const APP_TAG     = __ENV.APP_TAG     || 'dev';
const REPORT_FILE = __ENV.REPORT_FILE || '';

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m',  target: 10 },
    { duration: '15s', target: 0  },
  ],
  thresholds: {
    http_req_failed:   ['rate<0.05'],
    http_req_duration: ['p(95)<5000', 'p(99)<10000'],
  },
};

export function setup() {
  const res = http.get(`${BASE_URL}/products?limit=20`);
  check(res, { 'setup list 200': r => r.status === 200 });
  const products = res.json();
  return { ids: products.map(p => p.id), names: products.map(p => p.name) };
}

export default function (data) {
  const roll = __ITER % 3;

  if (roll === 0) {
    // List
    const r = http.get(`${BASE_URL}/products?limit=20`);
    check(r, { 'list 200': res => res.status === 200 });
  } else if (roll === 1 && data.ids.length > 0) {
    // By ID — hits Redis cache after first miss
    const id = data.ids[Math.floor(Math.random() * data.ids.length)];
    const r = http.get(`${BASE_URL}/products/${id}`);
    check(r, { 'getById 200': res => res.status === 200 });
  } else if (data.names.length > 0) {
    // By name — cache-aside
    const name = data.names[Math.floor(Math.random() * data.names.length)];
    const r = http.get(`${BASE_URL}/products/name/${encodeURIComponent(name)}`);
    check(r, { 'getByName 200': res => res.status === 200 });
  }

  sleep(1);
}

export function handleSummary(data) {
  const m = data.metrics;
  const fmtMs  = v => v === undefined ? 'n/a' : v.toFixed(1) + ' ms';
  const fmtPct = v => v === undefined ? 'n/a' : (v * 100).toFixed(2) + '%';

  const lines = [
    `=== Load Test — ${APP_TAG} ===`,
    `Date : ${new Date().toISOString()}`,
    `URL  : ${BASE_URL}`,
    '',
    'HTTP',
    `  Requests : ${m.http_reqs         ? m.http_reqs.values.count                  : 'n/a'}`,
    `  Failed   : ${m.http_req_failed   ? fmtPct(m.http_req_failed.values.rate)     : 'n/a'}`,
    `  Avg      : ${m.http_req_duration ? fmtMs(m.http_req_duration.values.avg)     : 'n/a'}`,
    `  p95      : ${m.http_req_duration ? fmtMs(m.http_req_duration.values['p(95)']): 'n/a'}`,
    `  p99      : ${m.http_req_duration ? fmtMs(m.http_req_duration.values['p(99)']): 'n/a'}`,
    '',
    'Checks',
    `  Passed   : ${m.checks ? m.checks.values.passes : 'n/a'}`,
    `  Failed   : ${m.checks ? m.checks.values.fails  : 'n/a'}`,
  ].join('\n');

  const out = { stdout: lines + '\n' };
  if (REPORT_FILE) out[REPORT_FILE] = lines + '\n';
  return out;
}
