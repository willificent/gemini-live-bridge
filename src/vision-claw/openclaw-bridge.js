// OpenClaw Gateway bridge for tool execution
// Routes tool calls to OpenClaw gateway via HTTP

class OpenClawBridge {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:18789';
    this.token = options.token || process.env.OPENCLAW_GATEWAY_TOKEN;
    this.sessionKey = options.sessionKey || process.env.OPENCLAW_SESSION_KEY || 'agent:main:voice';
    this.debug = options.debug || process.env.DEBUG === 'true';
  }

  async executeTask(task) {
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
      const errorText = await response.text();
      throw new Error(`OpenClaw request failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (this.debug) {
      console.log('[OpenClaw Response]', JSON.stringify(data, null, 2));
    }

    // Extract result from OpenAI-compatible response format
    const content = data.choices?.[0]?.message?.content;
    return content || 'No response from OpenClaw';
  }

  async healthCheck() {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });
      return response.ok;
    } catch (err) {
      return false;
    }
  }
}

module.exports = { OpenClawBridge };