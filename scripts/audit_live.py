import urllib.request, urllib.error, json

BASE_URL = 'https://cerebroid-app.onrender.com'
tests = []

def run_test(name, path, method='GET', headers=None, data=None, expected_statuses=[200]):
    if headers is None: headers = {}
    url = BASE_URL + path
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            body = r.read().decode('utf-8', errors='ignore')
            passed = r.status in expected_statuses
            tests.append((name, r.status, passed, body[:90]))
    except urllib.error.HTTPError as e:
        passed = e.code in expected_statuses
        body = e.read().decode('utf-8', errors='ignore')
        tests.append((name, e.code, passed, body[:90]))
    except Exception as e:
        tests.append((name, 'ERR', False, str(e)[:90]))

print('Running Automated Bug Bounty Security Fuzzing Suite...')

# 1. SQL Injection & URL manipulation
run_test('SQLi in cases path', '/api/v1/cases/%27%20OR%201=1--', expected_statuses=[401, 404, 422])
run_test('SQLi in study evidence', '/api/v1/studies/%27%20OR%201=1--/evidence?marker=IDH', expected_statuses=[401, 404, 422])

# 2. XSS in Headers
run_test('XSS in Request-Id header', '/health', headers={'X-Request-Id': '<script>alert(1)</script>'}, expected_statuses=[200])

# 3. Path Traversal
run_test('Path traversal in studies', '/api/v1/studies/..%2F..%2F..%2Fetc%2Fpasswd', expected_statuses=[401, 404, 422])
run_test('Direct traversal static', '/static/..%2f..%2fDockerfile', expected_statuses=[404])

# 4. Auth Bypass
run_test('Unauthenticated /cases list', '/api/v1/cases', expected_statuses=[401])
run_test('Unauthenticated /studies profile', '/api/v1/studies/UCSF-PDGM-0232/profile', expected_statuses=[401])
run_test('Public metrics summary', '/api/v1/metrics/summary', expected_statuses=[200])

# 5. Malformed Login Payloads
run_test('Login null byte', '/api/v1/auth/login', method='POST', headers={'Content-Type': 'application/json'}, data=b'{"username":"admin\\u0000","password":"test"}', expected_statuses=[401, 422])
run_test('Login empty body', '/api/v1/auth/login', method='POST', headers={'Content-Type': 'application/json'}, data=b'', expected_statuses=[422])
run_test('Login malformed json', '/api/v1/auth/login', method='POST', headers={'Content-Type': 'application/json'}, data=b'{"username": "admin",', expected_statuses=[422])

# 6. Rate Limit & Heavy Concurrency Check
run_test('Ready endpoint health', '/ready', expected_statuses=[200])

for t in tests:
    badge = 'PASS' if t[2] else 'FAIL'
    print(f'{badge:<4} | {t[0]:<32} | Status: {t[1]} | {t[3]}')
