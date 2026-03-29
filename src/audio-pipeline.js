// Simple mic → Gemini streaming, exactly matching test-mic.js pattern
// No classes, just functions that capture and pipe audio

const mic = require('mic');

class AudioPipeline {
  constructor() {
    this.micInstance = null;
    this.stream = null;
    this.onChunk = null;  // called with Buffer
    this.isActive = false;
  }

  start(onChunk) {
    if (this.isActive) return;
    this.onChunk = onChunk;

    console.log('🎤 Initializing microphone...');
    
    this.micInstance = mic({
      rate: 16000,
      channels: 1,
      bitwidth: 16,
      encoding: 'signed-integer',
      exitOnSilence: 0
    });

    this.stream = this.micInstance.getAudioStream();

    // Attach BEFORE starting
    this.stream.on('data', (buffer) => {
      if (this.onChunk) {
        this.onChunk(buffer);
      }
    });

    this.stream.on('error', (err) => {
      console.error('Mic stream error:', err);
    });

    this.micInstance.start();
    this.isActive = true;
    console.log('✅ Microphone active');
  }

  stop() {
    if (!this.isActive) return;
    if (this.micInstance) {
      this.micInstance.stop();
      this.micInstance = null;
    }
    this.stream = null;
    this.isActive = false;
    console.log('🛑 Microphone stopped');
  }
}

module.exports = { AudioPipeline };