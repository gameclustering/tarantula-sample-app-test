import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

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

export default function () {
  const res = http.get(`${BASE_URL}/products`);
  check(res, {
    'products 200': (r) => r.status === 200,
  });
  sleep(1);
}
