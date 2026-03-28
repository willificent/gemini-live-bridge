const fetch = require('node-fetch');
require('dotenv').config();

const gatewayHost = process.env.OPENCLAW_GATEWAY_HOST || 'http://host.docker.internal';
const gatewayPort = process.env.OPENCLAW_GATEWAY_PORT || '18789';
const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN;
const url = `${gatewayHost}:${gatewayPort}/v1/chat/completions`;

console.log(`Testing connectivity to: ${url}`);

const testPayload = {
  model: "test",
  messages: [{ role: "user", content: "ping" }],
  stream: false
};

fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${gatewayToken}`,
    'x-openclaw-session-key': 'test-session-123'
  },
  body: JSON.stringify(testPayload)
})
.then(res => {
  console.log(`Response status: ${res.status} ${res.statusText}`);
  return res.json();
})
.then(data => {
  console.log('Response data:', JSON.stringify(data, null, 2));
  console.log('✅ Bridge connectivity test successful!');
})
.catch(err => {
  console.error('❌ Connectivity test failed:', err.message);
  process.exit(1);
});
