const http = require('http');

const payload = {
  connectorType: 'splunk',
  connection: {
    host: '34.14.172.198',
    port: 8089,
    username: 'admin',
    secret: 'Welcome@123'
  },
  selection: { index: 'telecom_test_sample' },
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
