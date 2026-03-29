// Load mic package FIRST, then load @google/genai
const mic = require('mic');
console.log('✅ Mic loaded');

// Start mic immediately
const micInstance = mic({
  rate: 16000,
  channels: 1,
  bitwidth: 16,
  encoding: 'signed-integer',
  exitOnSilence: 0
});
const inputStream = micInstance.getAudioStream();

console.log('Mic stream created, attaching handler...');

inputStream.on('data', (buffer) => {
  console.log(`🎵 Chunk: ${buffer.length} bytes`);
});

micInstance.start();
console.log('Mic started');

// NOW load the heavy SDK
console.log('Loading @google/genai...');
const { GoogleGenAI } = require('@google/genai');
console.log('✅ SDK loaded');

// Keep alive
setTimeout(() => {
  console.log(`\nTest complete.`);
  process.exit(0);
}, 5000);