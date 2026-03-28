// src/audio-player.js
// Cross-platform audio playback using 'speaker' package
// Windows: may require windows-build-tools

const Speaker = require('speaker'); // npm install speaker

class AudioPlayer {
  constructor(options = {}) {
    this.sampleRate = options.sampleRate || 24000;
    this.channels = options.channels || 1;
    this.bitDepth = options.bitDepth || 16;
    this.instance = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      try {
        this.instance = new Speaker({
          channels: this.channels,
          bitDepth: this.bitDepth,
          sampleRate: this.sampleRate,
          device: process.env.AUDIO_OUTPUT_DEVICE || undefined
        });
        this.instance.on('close', () => {
          // Playback finished for current buffer
        });
        this.instance.on('error', (err) => reject(err));
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  async play(buffer) {
    if (!this.instance) await this.init();
    try {
      // Write buffer to speaker; returns immediately, audio plays async
      this.instance.write(buffer);
    } catch (err) {
      // If speaker closed or errored, reinitialize next time
      this.instance = null;
      throw err;
    }
  }

  stop() {
    if (this.instance) {
      this.instance.end();
      this.instance = null;
    }
  }
}

module.exports = { AudioPlayer };
