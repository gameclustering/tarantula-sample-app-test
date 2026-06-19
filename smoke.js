import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<5000'],
  },
};

export default function () {
  // Spring Boot Actuator health check — app is up and DB connected
  const health = http.get(`${BASE_URL}/actuator/health`);
  check(health, {
    'health 200': (r) => r.status === 200,
    'health UP': (r) => {
      try { return JSON.parse(r.body).status === 'UP'; } catch { return false; }
    },
  });

  sleep(1);
}
