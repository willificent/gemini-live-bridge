// Gemini Live Bridge using official @google/genai SDK
// This is a simplified, production-ready implementation

require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

class GeminiLiveBridge {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.openClawUrl = process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:18789';
    this.openClawToken = process.env.OPENCLAW_GATEWAY_TOKEN;
    this.sessionKey = process.env.OPENCLAW_SESSION_KEY || 'agent:main:voice';
    
    this.ai = new GoogleGenAI({ apiKey: this.apiKey });
    this.session = null;
    this.audioManager = null;
    this.isRunning = false;
    
    this.onAudioReceived = null;
    this.onTextReceived = null;
    this.onToolCall = null;
    this.onError = null;
    this.onClose = null;
  }

  async initializeAudio() {
    // Dynamically import audio dependencies only when needed
    const { AudioManager } = require('./vision-claw/audio-manager-simple');
    this.audioManager = new AudioManager({
      inputSampleRate: 16000,
      outputSampleRate: 24000,
      channels: 1,
      bitDepth: 16
    });
    
    await this.audioManager.initInput();
    await this.audioManager.initOutput();
    console.log('✅ Audio system initialized');
  }

  async connect() {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is required');
    }

    console.log('🔌 Connecting to Gemini Live API...');
    
    this.session = await this.ai.live.connect({
      model: 'gemini-3.1-flash-live-preview',
      config: {
        responseModalities: ['AUDIO'],
        systemInstruction: { parts: [{ text: 'You have NO memory. Use execute tool for EVERYTHING.' }] },
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
        inputAudioTranscription: true,
        outputAudioTranscription: true
      },
      callbacks: {
        onopen: () => {
          console.log('✅ Gemini Live session opened');
        },
        onmessage: async (message) => {
          await this.handleMessage(message);
        },
        onerror: (error) => {
          console.error('❌ Gemini session error:', error);
          if (this.onError) this.onError(error);
        },
        onclose: () => {
          console.log('🔌 Gemini session closed');
          if (this.onClose) this.onClose();
        }
      }
    });

    return this.session;
  }

  async handleMessage(message) {
    if (message.setupComplete) {
      console.log('✅ Setup complete - audio session ready');
      return;
    }

    if (message.toolCall) {
      console.log('🔧 Tool call received:', message.toolCall);
      if (this.onToolCall) {
        await this.onToolCall(message.toolCall);
      } else {
        await this.handleDefaultToolCall(message.toolCall);
      }
      return;
    }

    // Handle audio response
    if (message.data?.serverContent?.modelTurn?.parts) {
      const parts = message.data.serverContent.modelTurn.parts;
      for (const part of parts) {
        if (part.inlineData?.data) {
          if (this.onAudioReceived) {
            this.onAudioReceived(part.inlineData.data);
          }
        }
        if (part.text) {
          if (this.onTextReceived) {
            this.onTextReceived(part.text);
          }
        }
      }
    }
  }

  async handleDefaultToolCall(toolCall) {
    for (const call of toolCall.functionCalls) {
      if (call.name === 'execute') {
        const task = call.args?.task || JSON.stringify(call.args);
        try {
          const result = await this.executeOpenClawTask(task);
          
          await this.session.sendToolResponse({
            functionResponses: [{
              id: call.id,
              name: call.name,
              response: { result }
            }]
          });
        } catch (err) {
          console.error('Task execution failed:', err);
          await this.session.sendToolResponse({
            functionResponses: [{
              id: call.id,
              name: call.name,
              response: { result: `Error: ${err.message}` }
            }]
          });
        }
      }
    }
  }

  async executeOpenClawTask(task) {
    if (!this.openClawToken) {
      throw new Error('OPENCLAW_GATEWAY_TOKEN not configured');
    }

    const response = await fetch(`${this.openClawUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openClawToken}`,
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
      throw new Error(`OpenClaw request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'No response';
  }

  async startAudioStream() {
    if (!this.audioManager) {
      await this.initializeAudio();
    }

    // Set up audio output callback
    this.onAudioReceived = async (base64Audio) => {
      try {
        const audioBuffer = Buffer.from(base64Audio, 'base64');
        await this.audioManager.playAudio(audioBuffer);
      } catch (err) {
        console.error('Audio playback error:', err);
      }
    };

    // Start microphone and stream to Gemini
    this.audioManager.onData = async (buffer) => {
      try {
        const base64Audio = buffer.toString('base64');
        await this.session.sendRealtimeInput({
          audio: {
            data: base64Audio,
            mimeType: 'audio/pcm;rate=16000'
          }
        });
      } catch (err) {
        console.error('Failed to send audio:', err);
      }
    };

    await this.audioManager.startRecording();
    console.log('🎤 Audio streaming started');
  }

  async stop() {
    if (this.audioManager) {
      await this.audioManager.stopRecording();
      this.audioManager.cleanup();
    }
    if (this.session) {
      this.session.close();
    }
    this.isRunning = false;
    console.log('✅ Session stopped');
  }
}

// Export for use in test script
module.exports = { GeminiLiveBridge };