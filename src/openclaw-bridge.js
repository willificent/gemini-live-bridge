// src/openclaw-bridge.js
// No external fetch needed – Node.js 18+ has global fetch

class OpenClawBridge {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:18789';
    this.token = config.token || process.env.OPENCLAW_GATEWAY_TOKEN;
    this.sessionKey = config.sessionKey || process.env.OPENCLAW_SESSION_KEY || 'agent:main:voice';
  }

  async healthCheck() {
    // Send a minimal request to verify gateway connectivity
    return this.sendToOpenClaw('health check');
  }

  async sendToOpenClaw(task) {
    if (!this.token) {
      throw new Error('OpenClaw gateway token not configured');
    }

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        'x-openclaw-session-key': this.sessionKey
      },
      body: JSON.stringify({
        model: 'openclaw',
        messages: [{ role: 'user', content: task }],
        stream: false
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenClaw gateway error ${response.status}: ${text}`);
    }

    // Parse JSON; fallback to plain text if needed
    let data;
    try {
      data = await response.json();
    } catch (e) {
      return await response.text();
    }

    if (data.choices?.[0]?.message?.content) {
      return data.choices[0].message.content;
    }
    return JSON.stringify(data);
  }
}

module.exports = OpenClawBridge;
