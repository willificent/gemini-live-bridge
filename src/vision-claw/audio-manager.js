// Audio manager for microphone capture and speaker playback
// Based on VisionClaw patterns but simplified for Node.js

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
        console.log('🎤 Initializing microphone input...');
        this.micInstance = mic({
          rate: this.inputSampleRate,
          channels: this.channels,
          bitwidth: this.bitDepth,
          encoding: 'signed-integer',
          device: process.env.AUDIO_INPUT_DEVICE || undefined,
          exitOnSilence: 0
        });

        console.log('🎤 Mic instance created, getting audio stream...');
        this.inputStream = this.micInstance.getAudioStream();
        
        console.log('🔧 Stream properties:', {
          readable: this.inputStream.readable,
          readableFlowing: this.inputStream.readableFlowing,
          destroyed: this.inputStream.destroyed
        });

        this.inputStream.on('error', (err) => {
          console.error('❌ Audio stream error:', err);
          reject(err);
        });
        
        // Log ALL data events, even if isRecording is false (debug)
        this.inputStream.on('data', (buffer) => {
          console.log(`📥 Raw audio event (${buffer.length} bytes) [isRecording=${this.isRecording}]`);
          if (this.onData && this.isRecording) {
            this.onData(buffer);
          }
        });

        // Check listener count
        console.log('📊 Data listeners attached:', this.inputStream.listenerCount('data'));
        
        console.log('🎤 Starting mic instance...');
        this.micInstance.start();
        
        // Check flow state after start
        console.log('📊 Stream readableFlowing after start:', this.inputStream.readableFlowing);
        
        // Ensure stream is flowing
        if (this.inputStream.readableFlowing !== true) {
          console.log('⚡ Resuming input stream (was not flowing)...');
          this.inputStream.resume();
          console.log('📊 Stream readableFlowing after resume:', this.inputStream.readableFlowing);
        }
        
        console.log('✅ Microphone started successfully');
        resolve();
      } catch (err) {
        console.error('❌ Failed to initialize microphone:', err);
        reject(err);
      }
    });
  }

  async initOutput() {
    return new Promise((resolve, reject) => {
      try {
        console.log('🔊 Initializing speaker output...');
        this.outputStream = new speaker({
          channels: this.channels,
          bitDepth: this.bitDepth,
          sampleRate: this.outputSampleRate
        });
        this.outputStream.on('error', (err) => {
          console.error('❌ Speaker error:', err);
        });
        console.log('✅ Speaker initialized');
        resolve();
      } catch (err) {
        console.error('❌ Failed to initialize speaker:', err);
        reject(err);
      }
    });
  }

  async startRecording() {
    if (!this.inputStream) {
      await this.initInput();
    }
    this.isRecording = true;
    console.log('🎤 Microphone recording STARTED (isRecording=true)');
  }

  async stopRecording() {
    this.isRecording = false;
    console.log('🛑 Microphone recording STOPPED');
  }

  async playAudio(audioData) {
    if (!this.outputStream) {
      await this.initOutput();
    }
    try {
      console.log(`🔊 Playing audio chunk (${audioData.length} bytes)`);
      this.outputStream.write(audioData);
    } catch (err) {
      console.error('❌ Audio playback error:', err);
    }
  }

  cleanup() {
    if (this.micInstance) {
      this.micInstance.stop();
      this.micInstance = null;
    }
    this.inputStream = null;
    if (this.outputStream) {
      this.outputStream = null;
    }
  }
}

module.exports = { AudioManager };