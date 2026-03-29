// VisionClaw main coordinator - optional video for this checkpoint
// This class provides an API that could be extended for video later

const { CameraAccess } = require('./camera-access');
const { GeminiLiveService } = require('./gemini-live-service');
const { AudioManager } = require('./audio-manager');
const { OpenClawBridge } = require('./openclaw-bridge');

class VisionClaw {
  constructor(options = {}) {
    this.geminiService = new GeminiLiveService(options.gemini);
    this.openClawBridge = new OpenClawBridge(options.openclaw);
    this.audioManager = new AudioManager(options.audio);
    this.camera = new CameraAccess();
    
    this.sessionKey = options.sessionKey || `${this.geminiService.sessionKey}`;
    this.isRunning = false;
  }

  // Audio-only API for this checkpoint
  async startAudioSession() {
    // Initialize components
    await this.audioManager.initInput();
    await this.audioManager.initOutput();

    // Setup Gemini callbacks
    this.geminiService.onAudioReceived = async (base64Audio) => {
      try {
        console.log(`🔊 Received audio response (${base64Audio.length} chars base64)`);
        const audioBuffer = Buffer.from(base64Audio, 'base64');
        await this.audioManager.playAudio(audioBuffer);
        console.log('✅ Audio playback complete');
      } catch (err) {
        console.error('Audio playback failed:', err);
      }
    };

    this.geminiService.onTextReceived = (text) => {
      console.log('\n🤖 Gemini text response:', text);
    };

    this.geminiService.onToolCall = async (toolCall) => {
      await this.handleToolCall(toolCall);
    };

    // Start audio streaming to Gemini
    this.audioManager.onData = async (buffer) => {
      try {
        const base64Audio = buffer.toString('base64');
        await this.geminiService.sendAudio(base64Audio);
      } catch (err) {
        console.error('Send audio failed:', err);
      }
    };

    // Connect to Gemini
    await this.geminiService.connect();
    this.isRunning = true;
    console.log('✅ VisionClaw audio session started');
  }

  async stopAudioSession() {
    if (!this.isRunning) return;
    
    this.audioManager.cleanup();
    this.geminiService.disconnect();
    this.isRunning = false;
    console.log('✅ VisionClaw audio session stopped');
  }

  async handleToolCall(toolCall) {
    for (const call of toolCall.functionCalls) {
      if (call.name === 'execute') {
        const task = call.args?.task || JSON.stringify(call.args);
        try {
          console.log(`🔨 Executing: ${task.substring(0, 100)}`);
          const result = await this.openClawBridge.executeTask(task);
          
          this.geminiService.sendToolResponse({
            functionResponses: [{
              id: call.id,
              name: call.name,
              response: { result }
            }]
          });
        } catch (err) {
          console.error('Tool execution failed:', err);
          this.geminiService.sendToolResponse({
            functionResponses: [{
              id: call.id,
              name: call.name,
              response: { result: `Error: ${err.message}` }
            }]
          });
        }
      }
    }
  }

  // Future video methods (stub for now)
  async startCameraSession() {
    console.log('📷 Camera session not implemented in audio-only checkpoint');
    return false;
  }

  async stopCameraSession() {
    return true;
  }
}

module.exports = { VisionClaw };