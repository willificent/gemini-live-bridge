// Test: Does loading @google/genai interfere with mic?
require('dotenv').config();

// Load the SDK but do nothing with it
const { GoogleGenAI } = require('@google/genai');
console.log('✅ @google/genai loaded');

// Now try mic exactly as in test-mic.js
const mic = require('mic');

console.log('Testing mic package (with SDK loaded)...');

const micInstance = mic({
  rate: 16000,
  channels: 1,
  bitwidth: 16,
  encoding: 'signed-integer',
  exitOnSilence: 0
});

const inputStream = micInstance.getAudioStream();

console.log('Stream type:', typeof inputStream);
console.log('Has on method?', typeof inputStream.on);

let chunkCount = 0;
inputStream.on('data', (buffer) => {
  chunkCount++;
  console.log(`🎵 Chunk #${chunkCount}: ${buffer.length} bytes`);
});

inputStream.on('error', (err) => {
  console.error('Stream error:', err);
});

micInstance.start();
console.log('Mic started, speak now...');

setTimeout(() => {
  console.log(`\n⏱️ Test complete – total chunks: ${chunkCount}`);
  if (chunkCount === 0) {
    console.log('❌ NO AUDIO CAPTURED – mic events not firing');
  } else {
    console.log('✅ Mic working – audio chunks received');
  }
  process.exit(0);
}, 5000);