// Simplified AudioManager for use with @google/genai SDK
// Exactly matches the pattern from official example

const mic = require('mic');
const speaker = require('speaker');

class AudioManager {
  constructor(options = {}, geminiSession) {
    this.session = geminiSession;
    this.outputStream = null;
  }

  async startInput(sampleRate = 16000) {
    console.log('🎤 Setting up microphone...');
    
    const micInstance = mic({
      rate: sampleRate,
      channels: 1,
      bitwidth: 16,
      encoding: 'signed-integer',
      device: process.env.AUDIO_INPUT_DEVICE || undefined,
      exitOnSilence: 0
    });

    const inputStream = micInstance.getAudioStream();
    
    console.log('🔧 Stream properties:', {
      readable: inputStream.readable,
      readableFlowing: inputStream.readableFlowing,
      destroyed: inputStream.destroyed
    });

    inputStream.on('data', (buffer) => {
      console.log(`🎵 Mic chunk (${buffer.length}) [session:${!!this.session}]`);
      // Send directly to Gemini
      if (this.session) {
        this.session.sendRealtimeInput({
          audio: {
            data: buffer.toString('base64'),
            mimeType: `audio/pcm;rate=${sampleRate}`
          }
        }).catch(err => {
          console.error('Failed to send audio to Gemini:', err.message);
        });
      } else {
        console.error('❌ No Gemini session available!');
      }
    });

    inputStream.on('error', (err) => {
      console.error('Microphone stream error:', err);
    });

    micInstance.start();
    console.log('✅ Microphone streaming to Gemini');
    
    return micInstance; // Return for cleanup
  }

  async initOutput() {
    return new Promise((resolve, reject) => {
      try {
        this.outputStream = new speaker({
          channels: 1,
          bitDepth: 16,
          sampleRate: 24000
        });
        this.outputStream.on('error', console.error);
        console.log('✅ Speaker ready');
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  async playAudio(audioData) {
    if (!this.outputStream) {
      await this.initOutput();
    }
    try {
      console.log(`🔊 Playing audio (${audioData.length} bytes)`);
      this.outputStream.write(audioData);
    } catch (err) {
      console.error('Playback error:', err);
    }
  }

  cleanup(micInstance) {
    if (micInstance) {
      micInstance.stop();
    }
    if (this.outputStream) {
      this.outputStream.end();
      this.outputStream = null;
    }
  }
}

module.exports = { AudioManager };