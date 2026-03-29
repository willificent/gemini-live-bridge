// Gemini Live Bridge using official @google/genai SDK
// Simplified approach exactly matching official example

require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const { AudioManager } = require('./vision-claw/audio-manager-simple');

class GeminiLiveBridge {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.openClawUrl = process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:18789';
    this.openClawToken = process.env.OPENCLAW_GATEWAY_TOKEN;
    this.sessionKey = process.env.OPENCLAW_SESSION_KEY || 'agent:main:voice';
    
    this.ai = new GoogleGenAI({ apiKey: this.apiKey });
    this.session = null;
    this.micInstance = null;
    this.audioManager = null;
    this.isRunning = false;
    
    this.messageQueue = [];
    this.audioQueue = [];
    this.speaker = null;
  }

  async start() {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is required');
    }

    console.log('🤖 Starting Gemini Live Bridge...\n');

    // Initialize audio output manager (for playback) with no session yet
    this.audioManager = new AudioManager({}, null);
    await this.audioManager.initOutput();

    // Connect to Gemini
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
          console.log('✅ Gemini session opened');
        },
        onmessage: async (message) => {
          await this.handleMessage(message);
        },
        onerror: (error) => {
          console.error('❌ Gemini error:', error);
        },
        onclose: () => {
          console.log('🔌 Gemini session closed');
        }
      }
    });

    // Now set the session on the AudioManager so it can send audio
    this.audioManager.session = this.session;

    // Setup playback loop (process audio from Gemini)
    this.startPlaybackLoop();

    // Setup microphone (sends audio directly to Gemini)
    this.micInstance = await this.audioManager.startInput(16000);

    this.isRunning = true;
    console.log('\n✅ Bridge fully operational');
    console.log('🎤 Microphone active – speak now! (Ctrl+C to quit)\n');
  }

  async handleMessage(message) {
    // Check for setup complete
    if (message.setupComplete) {
      console.log('✅ Setup complete – ready for voice');
      return;
    }

    // Check for tool calls
    if (message.toolCall) {
      console.log('🔧 Tool call received:', JSON.stringify(message.toolCall, null, 2));
      await this.handleToolCall(message.toolCall);
      return;
    }

    // Queue audio responses for playback
    if (message.serverContent?.modelTurn?.parts) {
      for (const part of message.serverContent.modelTurn.parts) {
        if (part.inlineData?.data) {
          this.audioQueue.push(Buffer.from(part.inlineData.data, 'base64'));
        }
        if (part.text) {
          console.log(`💬 Gemini: ${part.text}`);
        }
      }
    }
  }

  async handleToolCall(toolCall) {
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

  startPlaybackLoop() {
    // Consume audio queue and play through speaker
    (async () => {
      while (this.isRunning) {
        if (this.audioQueue.length === 0) {
          await new Promise(resolve => setTimeout(resolve, 50));
          continue;
        }
        
        const chunk = this.audioQueue.shift();
        try {
          await this.audioManager.playAudio(chunk);
        } catch (err) {
          console.error('Playback error:', err);
        }
      }
    })();
  }

  async stop() {
    this.isRunning = false;
    if (this.micInstance) {
      this.micInstance.stop();
      this.micInstance = null;
    }
    if (this.session) {
      this.session.close();
    }
    if (this.audioManager) {
      if (this.audioManager.outputStream) {
        this.audioManager.outputStream.end();
      }
    }
    console.log('✅ Bridge stopped');
  }
}

// Export and also allow direct run
if (require.main === module) {
  runLive().catch(console.error);
}

module.exports = { GeminiLiveBridge };

async function runLive() {
  const bridge = new GeminiLiveBridge();
  
  // Handle Ctrl+C
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    await bridge.stop();
    process.exit(0);
  });

  await bridge.start();
}