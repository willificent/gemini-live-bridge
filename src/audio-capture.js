// src/audio-capture.js
// Cross-platform microphone capture using 'speaker' and 'mic' packages
// Windows: install windows-build-tools if native compilation fails

const mic = require('mic'); // npm install mic

class AudioCapture {
  constructor(options = {}) {
    this.sampleRate = options.sampleRate || 16000;
    this.channels = options.channels || 1;
    this.bitDepth = options.bitDepth || 16;
    this.instance = null;
    this.onData = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      try {
        this.instance = mic({
          rate: this.sampleRate,
          channels: this.channels,
          bitwidth: this.bitDepth,
          encoding: 'signed-integer',
          device: process.env.AUDIO_INPUT_DEVICE || undefined,
          exitOnSilence: 0
        });

        this.instance.on('error', (err) => reject(err));
        this.instance.on('data', (buffer) => {
          if (this.onData) this.onData(buffer);
        });
        this.instance.start();
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  start() {
    if (this.instance && this.instance.start) this.instance.start();
  }

  stop() {
    if (this.instance && this.instance.stop) this.instance.stop();
  }
}

module.exports = { AudioCapture };
