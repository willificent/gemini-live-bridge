// Simplified AudioManager for use with @google/genai SDK
// Uses mic/speaker packages but manages stream flow properly

const mic = require('mic');
const speaker = require('speaker');

class AudioManager {
  constructor(options = {}) {
    this.inputSampleRate = options.inputSampleRate || 16000;
    this.outputSampleRate = options.outputSampleRate || 24000;
    this.channels = options.channels || 1;
    this.bitDepth = options.bitDepth || 16;
    
    this.micInstance = null;
    this.inputStream = null;
    this.outputStream = null;
    this.isRecording = false;
    this.onData = null;
  }

  async initInput() {
    return new Promise((resolve, reject) => {
      try {
        console.log('🎤 Setting up microphone...');
        this.micInstance = mic({
          rate: this.inputSampleRate,
          channels: this.channels,
          bitwidth: this.bitDepth,
          encoding: 'signed-integer',
          device: process.env.AUDIO_INPUT_DEVICE || undefined,
          exitOnSilence: 0
        });

        this.inputStream = this.micInstance.getAudioStream();
        
        this.inputStream.on('error', reject);
        
        this.inputStream.on('data', (buffer) => {
          if (this.onData && this.isRecording) {
            this.onData(buffer);
          }
        });

        this.micInstance.start();
        console.log('✅ Microphone ready');
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  async initOutput() {
    return new Promise((resolve, reject) => {
      try {
        this.outputStream = new speaker({
          channels: this.channels,
          bitDepth: this.bitDepth,
          sampleRate: this.outputSampleRate
        });
        this.outputStream.on('error', console.error);
        console.log('✅ Speaker ready');
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
    console.log('🎤 Recording started');
  }

  async stopRecording() {
    this.isRecording = false;
    console.log('🛑 Recording stopped');
  }

  async playAudio(audioData) {
    if (!this.outputStream) {
      await this.initOutput();
    }
    try {
      this.outputStream.write(audioData);
    } catch (err) {
      console.error('Playback error:', err);
    }
  }

  cleanup() {
    if (this.micInstance) {
      this.micInstance.stop();
      this.micInstance = null;
    }
    this.inputStream = null;
    this.outputStream = null;
  }
}

module.exports = { AudioManager };