// Raw WebSocket client for Gemini Live API
// No @google/genai SDK – pure WebSocket

const WebSocket = require('ws');

class GeminiLiveClient {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.model = options.model || 'models/gemini-3.1-flash-live-preview';
    this.debug = options.debug || false;
    
    this.ws = null;
    this.isConnected = false;
    this.isReady = false;
    
    this.onAudio = null;      // audio response (base64)
    this.onText = null;       // text response
    this.onToolCall = null;   // tool call
    this.onReady = null;      // setup complete
    this.onError = null;
    this.onClose = null;
  }

  async connect() {
    if (!this.apiKey) throw new Error('GEMINI_API_KEY required');

    const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;
    
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        this.isConnected = true;
        console.log('✅ WebSocket connected');
        this.sendSetup();
        resolve();
      });

      this.ws.on('message', async (data) => {
        try {
          const msg = JSON.parse(data);
          this.handleMessage(msg);
        } catch (err) {
          console.error('Parse error:', err);
        }
      });

      this.ws.on('error', (err) => {
        console.error('WebSocket error:', err);
        if (this.onError) this.onError(err);
        reject(err);
      });

      this.ws.on('close', (code, reason) => {
        console.log(`WebSocket closed: ${code} ${reason}`);
        this.isConnected = false;
        this.isReady = false;
        if (this.onClose) this.onClose();
      });
    });
  }

  sendSetup() {
    const setup = {
      setup: {
        model: this.model,
        generationConfig: { responseModalities: ['AUDIO'] },
        systemInstruction: { parts: [{ text: 'You have NO memory. Use execute tool for EVERYTHING.' }] },
        tools: [{
          functionDeclarations: [{
            name: 'execute',
            description: 'Execute any task by calling the OpenClaw agent',
            parameters: {
              type: 'object',
              properties: { task: { type: 'string' } },
              required: ['task']
            }
          }]
        }],
        realtimeInputConfig: {},  // minimal
        inputAudioTranscription: {},
        outputAudioTranscription: {}
      }
    };

    if (this.debug) console.log('Sending setup:', JSON.stringify(setup, null, 2));
    this.ws.send(JSON.stringify(setup));
  }

  handleMessage(msg) {
    if (msg.setupComplete) {
      console.log('✅ Setup complete');
      this.isReady = true;
      if (this.onReady) this.onReady();
      return;
    }

    if (msg.error) {
      console.error('Gemini error:', msg.error);
      return;
    }

    if (msg.toolCall) {
      if (this.onToolCall) this.onToolCall(msg.toolCall);
      return;
    }

    if (msg.serverContent?.modelTurn?.parts) {
      for (const part of msg.serverContent.modelTurn.parts) {
        if (part.inlineData?.data && this.onAudio) {
          this.onAudio(part.inlineData.data);
        }
        if (part.text && this.onText) {
          this.onText(part.text);
        }
      }
    }
  }

  sendAudio(base64Audio) {
    if (!this.isConnected || !this.isReady) {
      throw new Error('Not connected or not ready');
    }
    this.ws.send(JSON.stringify({
      realtimeInput: {
        audio: {
          mimeType: 'audio/pcm;rate=16000',
          data: base64Audio
        }
      }
    }));
  }

  sendToolResponse(functionResponses) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not open');
    }
    this.ws.send(JSON.stringify({ toolResponse: functionResponses }));
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.isReady = false;
  }
}

module.exports = { GeminiLiveClient };