// src/gemini-client.js
// WebSocket client for Gemini Live API with audio and tool routing

const WebSocket = require('ws');
const { captureAudio } = require('./audio-capture');
const { playAudio } = require('./audio-player');
const { v4: uuidv4 } = require('uuid');
const OpenClawBridge = require('./openclaw-bridge');
const ToolRouter = require('./tool-router');

class GeminiLiveClient {
  constructor(config = {}) {
    this.apiKey = config.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    this.gatewayUrl = config.OPENCLAW_GATEWAY_URL || process.env.OPENCLAW_GATEWAY_URL;
    this.gatewayToken = config.OPENCLAW_GATEWAY_TOKEN || process.env.OPENCLAW_GATEWAY_TOKEN;
    this.sessionKey = config.OPENCLAW_SESSION_KEY || process.env.OPENCLAW_SESSION_KEY || `agent:main:voice-${uuidv4()}`;
    this.debug = config.debug || process.env.DEBUG === 'true';
    this.mockMode = config.mockMode || false;
    this.audioEnabled = !this.mockMode;

    this.ws = null;
    this.openClawBridge = new OpenClawBridge({
      baseUrl: this.gatewayUrl,
      token: this.gatewayToken,
      sessionKey: this.sessionKey
    });
    this.toolRouter = new ToolRouter(this.openClawBridge);
    this.audioCapture = null;
    this.audioPlayer = null;
  }

  async connect() {
    if (this.mockMode) {
      console.log('🎭 Running in MOCK mode (no real Gemini connection)');
      await this.runMockSession();
      return;
    }

    if (!this.apiKey) throw new Error('GEMINI_API_KEY not set');

    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;
    console.log('🔗 Connecting to Gemini Live API...');
    this.ws = new WebSocket(wsUrl);

    this.ws.on('open', () => {
      console.log('✅ WebSocket connected');
      this.sendSetupMessage();
    });

    this.ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data);
        if (this.debug) console.log('[WS]', JSON.stringify(msg, null, 2));
        await this.handleMessage(msg);
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    });

    this.ws.on('error', (err) => console.error('WebSocket error:', err));
    this.ws.on('close', () => {
      console.log('WebSocket closed');
      this.cleanup();
    });
  }

  sendSetupMessage() {
    const setup = {
      setup: {
        model: 'gemini-3.1-flash-lite-preview',
        tools: [{ functionDeclarations: [{ name: 'execute', description: 'Execute any task by calling the OpenClaw agent', parameters: { type: 'object', properties: { task: { type: 'string', description: 'The task or query for the agent' } }, required: ['task'] } }] }],
        systemInstruction: { parts: [{ text: 'You have NO memory. Use execute tool for EVERYTHING.' }] },
        responseModalities: ['AUDIO'],
        mediaTranscription: { inputAudioTranscription: { enabled: true }, outputAudioTranscription: { enabled: true } }
      }
    };
    this.ws.send(JSON.stringify(setup));
  }

  async handleMessage(msg) {
    if (msg.setupComplete) {
      console.log('✅ Setup complete. Starting audio...');
      await this.startAudio();
      return;
    }

    if (msg.serverContent) {
      const { audio, text } = msg.serverContent;
      if (audio?.data) await this.playAudioChunk(audio.data);
      if (text) console.log('\n🤖 Gemini says:', text);
    }

    if (msg.toolCall) {
      await this.toolRouter.handleToolCall(msg, this.ws);
    }
  }

  async startAudio() {
    if (!this.audioEnabled) return;
    try {
      this.audioCapture = await captureAudio({ sampleRate: 16000, channels: 1, bitDepth: 16 });
      this.audioPlayer = await playAudio({ sampleRate: 24000, channels: 1, bitDepth: 16 });

      this.audioCapture.on('data', (pcmBuffer) => {
        if (this.ws.readyState === WebSocket.OPEN) {
          const base64Audio = pcmBuffer.toString('base64');
          this.ws.send(JSON.stringify({
            realtimeInput: { audio: { mimeType: 'audio/pcm;rate=16000', data: base64Audio } }
          }));
        }
      });

      this.audioCapture.start();
      console.log('🎤 Microphone active - start speaking!');
    } catch (err) {
      console.error('⚠️ Audio initialization failed, continuing without audio:', err.message);
      this.audioEnabled = false;
    }
  }

  async playAudioChunk(base64Audio) {
    if (!this.audioEnabled || !this.audioPlayer) return;
    try {
      const pcmBuffer = Buffer.from(base64Audio, 'base64');
      await this.audioPlayer.play(pcmBuffer);
    } catch (err) {
      console.error('Audio playback error:', err.message);
    }
  }

  cleanup() {
    if (this.audioCapture) {
      this.audioCapture.stop();
      this.audioCapture = null;
    }
    if (this.audioPlayer) {
      this.audioPlayer.stop();
      this.audioPlayer = null;
    }
  }

  async runMockSession() {
    console.log('🎭 Mock session: simulating a tool call roundtrip');
    const mockMsg = {
      toolCall: {
        functionCalls: [{
          id: 'mock-call-1',
          name: 'execute',
          args: { task: 'What is my name?' }
        }]
      }
    };
    await this.toolRouter.handleToolCall(mockMsg, null);
    console.log('✅ Mock session completed. Bridge logic works!');
  }
}

module.exports = GeminiLiveClient;
