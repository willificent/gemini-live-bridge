// Simplified version – audio logic inline like official example
require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const mic = require('mic');
const speaker = require('speaker');

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY required');

  // Setup speaker for playback
  const speakerOut = new speaker({
    channels: 1,
    bitDepth: 16,
    sampleRate: 24000
  });
  speakerOut.on('error', console.error);
  console.log('✅ Speaker ready');

  // Connect to Gemini
  console.log('🔌 Connecting to Gemini Live API...');
  const ai = new GoogleGenAI({ apiKey });
  const session = await ai.live.connect({
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
            properties: { task: { type: 'string' } },
            required: ['task']
          }
        }]
      }],
      inputAudioTranscription: true,
      outputAudioTranscription: true
    },
    callbacks: {
      onopen: () => console.log('✅ Gemini session opened'),
      onmessage: async (msg) => {
        if (msg.setupComplete) {
          console.log('✅ Setup complete – ready for voice');
          return;
        }
        if (msg.toolCall) {
          console.log('🔧 Tool call:', JSON.stringify(msg.toolCall, null, 2));
          // TODO: execute via OpenClaw, send response
          return;
        }
        if (msg.serverContent?.modelTurn?.parts) {
          for (const part of msg.serverContent.modelTurn.parts) {
            if (part.inlineData?.data) {
              speakerOut.write(Buffer.from(part.inlineData.data, 'base64'));
              console.log('🔊 Played audio response');
            }
            if (part.text) {
              console.log(`💬 Gemini: ${part.text}`);
            }
          }
        }
      },
      onerror: (err) => console.error('❌ Gemini error:', err),
      onclose: () => console.log('🔌 Gemini session closed')
    }
  });

  // Setup microphone – EXACT pattern from official example
  console.log('🎤 Setting up microphone...');
  const micInstance = mic({
    rate: 16000,
    channels: 1,
    bitwidth: 16,
    encoding: 'signed-integer',
    device: process.env.AUDIO_INPUT_DEVICE || undefined,
    exitOnSilence: 0
  });

  const micInputStream = micInstance.getAudioStream();
  
  micInputStream.on('data', (buffer) => {
    console.log(`🎵 Mic chunk (${buffer.length} bytes)`);
    session.sendRealtimeInput({
      audio: {
        data: buffer.toString('base64'),
        mimeType: 'audio/pcm;rate=16000'
      }
    }).catch(err => {
      console.error('Send failed:', err.message);
    });
  });

  micInputStream.on('error', (err) => {
    console.error('Mic stream error:', err);
  });

  micInstance.start();
  
  console.log('✅ Microphone streaming to Gemini');
  console.log('\n🎤 Speak now! (Ctrl+C to quit)\n');

  // Keep alive
  await new Promise(() => {});
}

process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  process.exit(0);
});

main().catch(console.error);