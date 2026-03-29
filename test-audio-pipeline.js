require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const mic = require('mic');
const speaker = require('speaker');

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY required');

  // Setup speaker
  const speakerOut = new speaker({ channels: 1, bitDepth: 16, sampleRate: 24000 });
  speakerOut.on('error', console.error);
  console.log('✅ Speaker initialized');

  // Connect to Gemini
  console.log('🔌 Connecting to Gemini...');
  const ai = new GoogleGenAI({ apiKey });
  const session = await ai.live.connect({
    model: 'gemini-3.1-flash-live-preview',
    config: {
      responseModalities: ['AUDIO'],
      systemInstruction: { parts: [{ text: 'You are a helpful assistant.' }] },
      inputAudioTranscription: true,
      outputAudioTranscription: true
    },
    callbacks: {
      onopen: () => console.log('✅ Gemini connected'),
      onmessage: async (msg) => {
        if (msg.setupComplete) {
          console.log('✅ Setup complete – listening');
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
      onclose: () => console.log('🔌 Gemini closed')
    }
  });

  // Setup mic – EXACT pattern from official example
  console.log('🎤 Initializing microphone...');
  const micInstance = mic({
    rate: 16000,
    channels: 1,
    bitwidth: 16,
    encoding: 'signed-integer',
    exitOnSilence: 0
  });

  const micStream = micInstance.getAudioStream();

  // Immediately attach data handler
  micStream.on('data', (buffer) => {
    console.log(`🎤 Mic chunk: ${buffer.length} bytes`);
    session.sendRealtimeInput({
      audio: {
        data: buffer.toString('base64'),
        mimeType: 'audio/pcm;rate=16000'
      }
    }).catch(err => {
      console.error('Send error:', err.message);
    });
  });

  micStream.on('error', (err) => {
    console.error('Mic stream error:', err);
  });

  // Start mic AFTER attaching handler
  micInstance.start();
  console.log('✅ Microphone active – speak now!');
  console.log('(Press Ctrl+C to quit)\n');

  // Keep alive
  await new Promise(() => {});
}

process.on('SIGINT', () => {
  console.log('\n🛑 Exiting...');
  process.exit(0);
});

main().catch(console.error);