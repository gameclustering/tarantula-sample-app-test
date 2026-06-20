import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL    = __ENV.BASE_URL    || 'http://localhost:8080';
const APP_TAG     = __ENV.APP_TAG     || 'dev';
const REPORT_FILE = __ENV.REPORT_FILE || '';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_failed:   ['rate<0.01'],
    http_req_duration: ['p(95)<5000'],
  },
};

export function setup() {
  const ts = Date.now();
  const seeded = [];
  for (let i = 1; i <= 5; i++) {
    const res = http.post(
      `${BASE_URL}/products`,
      JSON.stringify({
        name:        `prod-${ts}-${i}`,
        description: `Test product ${i}`,
        price:       parseFloat((i * 9.99).toFixed(2)),
        quantity:    i * 10,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
    const ok = check(res, { [`insert-${i} 200`]: r => r.status === 200 || r.status === 201 });
    if (ok) {
      const p = res.json();
      seeded.push({ id: p.id, name: p.name });
    }
  }
  return { products: seeded };
}

export default function (data) {
  // List all products (DB read, no cache layer)
  const list = http.get(`${BASE_URL}/products?limit=20`);
  check(list, {
    'list 200':       r => r.status === 200,
    'list non-empty': r => r.json().length > 0,
  });

  if (data.products.length > 0) {
    const p = data.products[__ITER % data.products.length];

    // First call: DB hit → writes to Redis cache
    // Subsequent calls (same VU iterating): Redis cache hit
    const byId = http.get(`${BASE_URL}/products/${p.id}`);
    check(byId, {
      'getById 200':     r => r.status === 200,
      'getById correct': r => r.json().id === p.id,
    });

    const byName = http.get(`${BASE_URL}/products/name/${encodeURIComponent(p.name)}`);
    check(byName, {
      'getByName 200':     r => r.status === 200,
      'getByName correct': r => r.json().name === p.name,
    });
  }

  sleep(1);
}

export function handleSummary(data) {
  const m = data.metrics;
  const fmtMs  = v => v === undefined ? 'n/a' : v.toFixed(1) + ' ms';
  const fmtPct = v => v === undefined ? 'n/a' : (v * 100).toFixed(2) + '%';

  const lines = [
    `=== Smoke Test — ${APP_TAG} ===`,
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
