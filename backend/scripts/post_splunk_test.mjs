import http from 'node:http';

const payload = {
  connectorType: 'splunk',
  connection: {
    host: 'localhost',
    port: 8089,
    username: 'admin',
    password: 'REDACTED'
  },
  selection: { index: 'main' },
  sync: { timeRange: 'Last 24 hours' }
};

const data = JSON.stringify(payload);

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/connectors/test',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.setEncoding('utf8');
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('HTTP', res.statusCode);
    console.log(body);
  });
});

req.on('error', (e) => {
  console.error('Request error:', e);
});

req.write(data);
req.end();
