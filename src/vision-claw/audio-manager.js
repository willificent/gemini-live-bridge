// Audio manager for microphone capture and speaker playback
// Based on VisionClaw patterns but simplified for Node.js

const mic = require('mic');
const { Speaker } = require('speaker');

class AudioManager {
  constructor(options = {}) {
    this.inputSampleRate = options.inputSampleRate || 16000;
    this.outputSampleRate = options.outputSampleRate || 24000;
    this.channels = options.channels || 1;
    this.bitDepth = options.bitDepth || 16;
    
    this.inputStream = null;
    this.outputStream = null;
    this.isRecording = false;
    this.onData = null;
  }

  async initInput() {
    return new Promise((resolve, reject) => {
      try {
        const micInstance = mic({
          rate: this.inputSampleRate,
          channels: this.channels,
          bitwidth: this.bitDepth,
          encoding: 'signed-integer',
          device: process.env.AUDIO_INPUT_DEVICE || undefined,
          exitOnSilence: 0
        });

        micInstance.on('error', (err) => {
          console.error('Mic error:', err);
          reject(err);
        });
        
        micInstance.on('data', (buffer) => {
          if (this.onData && this.isRecording) {
            this.onData(buffer);
          }
        });

        this.inputStream = micInstance;
        this.inputStream.start();
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  async initOutput() {
    return new Promise((resolve, reject) => {
      try {
        const speaker = new Speaker({
          channels: this.channels,
          bitDepth: this.bitDepth,
          sampleRate: this.outputSampleRate
        });
        this.outputStream = speaker;
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  async startRecording() {
    if (!this.inputStream) {
      await this.initInput();
    }
    this.isRecording = true;
  }

  async stopRecording() {
    this.isRecording = false;
  }

  async playAudio(audioData) {
    if (!this.outputStream) {
      await this.initOutput();
    }
    try {
      // Audio data should be Buffer containing PCM audio
      this.outputStream.write(audioData);
    } catch (err) {
      console.error('Audio playback error:', err);
    }
  }

  cleanup() {
    if (this.inputStream) {
      this.inputStream.stop();
      this.inputStream = null;
    }
    if (this.outputStream) {
      this.outputStream = null;
    }
  }
}

module.exports = { AudioManager };