// Main audio pipeline that orchestrates all components
// Entry point for the VisionClaw bridge functionality

const { AudioCapture } = require('./audio-capture');

class AudioPipeline {
  constructor(config = {}) {
    this.audioCapture = new AudioCapture(config);
    this.isRunning = false;
    this.onTranscript = config.onTranscript || null;
    this.onError = config.onError || null;
  }

  async initialize() {
    try {
      await this.audioCapture.initialize();
      this.audioCapture.onTranscript = this.onTranscript;
      return true;
    } catch (err) {
      console.error('Failed to initialize audio pipeline:', err);
      if (this.onError) this.onError(err);
      return false;
    }
  }

  async start() {
    if (this.isRunning) return;
    
    try {
      await this.audioCapture.start();
      this.isRunning = true;
      console.log('✅ Audio pipeline started');
    } catch (err) {
      console.error('Failed to start audio pipeline:', err);
      if (this.onError) this.onError(err);
      throw err;
    }
  }

  async stop() {
    if (!this.isRunning) return;
    
    try {
      await this.audioCapture.stop();
      this.isRunning = false;
      console.log('✅ Audio pipeline stopped');
    } catch (err) {
      console.error('Failed to stop audio pipeline:', err);
      if (this.onError) this.onError(err);
    }
  }

  async cleanup() {
    this.audioCapture.cleanup();
  }
}

module.exports = { AudioPipeline };