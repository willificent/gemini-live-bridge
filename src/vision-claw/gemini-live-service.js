// Gemini Live API service for real-time voice interaction
// WebSocket client for Gemini's bidirectional streaming API

const WebSocket = require('ws');

class GeminiLiveService {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.GEMINI_API_KEY;
    this.sessionKey = options.sessionKey || process.env.OPENCLAW_SESSION_KEY || `agent:main:voice-${Date.now()}`;
    this.debug = options.debug || process.env.DEBUG === 'true';
    
    this.ws = null;
    this.isConnected = false;
    this.audioEnabled = false;
    
    this.onAudioReceived = null;
    this.onTextReceived = null;
    this.onToolCall = null;
    this.onSetupComplete = null;
    this.onError = null;
    this.onClose = null;
  }

  async connect() {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is required');
    }

    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;
    
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        console.log('✅ Connected to Gemini Live API');
        this.isConnected = true;
        this.sendSetupMessage();
        resolve();
      });

      this.ws.on('message', async (data) => {
        try {
          const msg = JSON.parse(data);
          if (this.debug) {
            console.log('[Gemini]', JSON.stringify(msg, null, 2));
          }
          await this.handleMessage(msg);
        } catch (err) {
          console.error('Failed to parse Gemini message:', err);
        }
      });

      this.ws.on('error', (err) => {
        console.error('WebSocket error:', err);
        if (this.onError) this.onError(err);
      });

      this.ws.on('close', () => {
        console.log('WebSocket closed');
        this.isConnected = false;
        if (this.onClose) this.onClose();
      });
    });
  }

  sendSetupMessage() {
    const setup = {
      setup: {
        model: 'gemini-2.0-flash-exp',
        tools: [{
          functionDeclarations: [{
            name: 'execute',
            description: 'Execute any task by calling the OpenClaw agent',
            parameters: {
              type: 'object',
              properties: {
                task: { type: 'string', description: 'The task or query for the agent' }
              },
              required: ['task']
            }
          }]
        }],
        systemInstruction: {
          parts: [{ text: 'You have NO memory. Use execute tool for EVERYTHING.' }]
        },
        responseModalities: ['AUDIO'],
        mediaTranscription: {
          inputAudioTranscription: { enabled: true },
          outputAudioTranscription: { enabled: true }
        }
      }
    };
    this.ws.send(JSON.stringify(setup));
  }

  async handleMessage(msg) {
    if (msg.setupComplete) {
      console.log('✅ Setup complete. Audio session ready.');
      this.audioEnabled = true;
      if (this.onSetupComplete) this.onSetupComplete();
      return;
    }

    if (msg.serverContent) {
      const { audio, text } = msg.serverContent;
      if (audio?.data && this.onAudioReceived) {
        this.onAudioReceived(audio.data);
      }
      if (text && this.onTextReceived) {
        this.onTextReceived(text);
      }
    }

    if (msg.toolCall) {
      if (this.onToolCall) {
        await this.onToolCall(msg.toolCall);
      }
    }
  }

  async sendAudio(base64AudioData) {
    if (!this.isConnected || !this.audioEnabled) {
      throw new Error('Not connected or audio not enabled');
    }
    
    this.ws.send(JSON.stringify({
      realtimeInput: {
        audio: {
          mimeType: 'audio/pcm;rate=16000',
          data: base64AudioData
        }
      }
    }));
  }

  sendToolResponse(functionResponse) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not open');
    }
    
    this.ws.send(JSON.stringify({
      toolResponse: functionResponse
    }));
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
}

module.exports = { GeminiLiveService };