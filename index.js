#!/usr/bin/env node
// Gemini Live Bridge – Pure WebSocket implementation
// No @google/genai SDK – uses ws directly

require('dotenv').config();
const { WebSocket } = require('ws');
const { AudioPipeline } = require('./src/audio-pipeline');
const speaker = require('speaker');

class OpenClawBridge {
  constructor() {
    this.baseUrl = process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:18789';
    this.token = process.env.OPENCLAW_GATEWAY_TOKEN;
    this.sessionKey = process.env.OPENCLAW_SESSION_KEY || 'agent:main:voice';
  }

  async execute(task) {
    if (!this.token) throw new Error('OPENCLAW_GATEWAY_TOKEN not set');

    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
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

    if (!res.ok) {
      throw new Error(`OpenClaw: ${res.status}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || 'No response';
  }
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY not set');
    process.exit(1);
  }

  // Setup speaker
  const speakerOut = new speaker({ channels: 1, bitDepth: 16, sampleRate: 24000 });
  speakerOut.on('error', console.error);
  console.log('✅ Speaker ready');

  // Connect to Gemini Live API via WebSocket
  console.log('🔌 Connecting to Gemini...');
  const ws = new WebSocket(
    `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`
  );

  const audioPipeline = new AudioPipeline();
  const openClaw = new OpenClawBridge();

  ws.on('open', () => {
    console.log('✅ WebSocket open');
    sendSetup();
  });

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data);
      handleMessage(msg);
    } catch (err) {
      console.error('Message parse error:', err);
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });

  ws.on('close', () => {
    console.log('🔌 WebSocket closed');
    audioPipeline.stop();
  });

  function sendSetup() {
    const setup = {
      setup: {
        model: 'models/gemini-3.1-flash-live-preview',
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
        realtimeInputConfig: {},
        inputAudioTranscription: {},
        outputAudioTranscription: {}
      }
    };
    ws.send(JSON.stringify(setup));
    console.log('📤 Setup sent');
  }

  function handleMessage(msg) {
    if (msg.setupComplete) {
      console.log('✅ Setup complete');
      // Start mic AFTER setup to ensure we're ready
      audioPipeline.start((buffer) => {
        // Mic chunk captured – send to Gemini
        ws.send(JSON.stringify({
          realtimeInput: {
            audio: {
              mimeType: 'audio/pcm;rate=16000',
              data: buffer.toString('base64')
            }
          }
        }));
      });
      return;
    }

    if (msg.error) {
      console.error('Gemini error:', msg.error);
      return;
    }

    if (msg.toolCall) {
      handleToolCall(msg.toolCall);
      return;
    }

    if (msg.serverContent?.modelTurn?.parts) {
      for (const part of msg.serverContent.modelTurn.parts) {
        if (part.inlineData?.data) {
          // Play audio response
          speakerOut.write(Buffer.from(part.inlineData.data, 'base64'));
        }
        if (part.text) {
          console.log(`💬 Gemini: ${part.text}`);
        }
      }
    }
  }

  async function handleToolCall(toolCall) {
    for (const call of toolCall.functionCalls) {
      if (call.name === 'execute') {
        const task = call.args?.task || JSON.stringify(call.args);
        try {
          const result = await openClaw.execute(task);
          ws.send(JSON.stringify({
            toolResponse: {
              functionResponses: [{
                id: call.id,
                name: call.name,
                response: { result }
              }]
            }
          }));
        } catch (err) {
          ws.send(JSON.stringify({
            toolResponse: {
              functionResponses: [{
                id: call.id,
                name: call.name,
                response: { result: `Error: ${err.message}` }
              }]
            }
          }));
        }
      }
    }
  }

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    audioPipeline.stop();
    ws.close();
    process.exit(0);
  });
}

main().catch(console.error);