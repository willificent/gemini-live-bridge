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
    this.audioChunkCount = 0;
  }

  // Audio-only API for this checkpoint
  async startAudioSession() {
    console.log('\n🚀 Starting VisionClaw audio session...');
    
    // Initialize components
    console.log('📋 Step 1: Initializing audio input...');
    await this.audioManager.initInput();
    console.log('📋 Step 2: Initializing audio output...');
    await this.audioManager.initOutput();

    // Setup Gemini callbacks
    console.log('📋 Step 3: Setting up Gemini callbacks...');
    this.geminiService.onAudioReceived = async (base64Audio) => {
      try {
        console.log(`🔊 Gemini responded with audio (${base64Audio.length} chars base64)`);
        const audioBuffer = Buffer.from(base64Audio, 'base64');
        await this.audioManager.playAudio(audioBuffer);
        console.log('✅ Audio playback finished');
      } catch (err) {
        console.error('❌ Audio playback failed:', err);
      }
    };

    this.geminiService.onTextReceived = (text) => {
      console.log('\n💬 Gemini text response:', text);
    };

    this.geminiService.onToolCall = async (toolCall) => {
      console.log('🔧 Tool call received:', JSON.stringify(toolCall, null, 2));
      await this.handleToolCall(toolCall);
    };

    // Start audio streaming to Gemini
    console.log('📋 Step 4: Setting up audio data handler...');
    this.audioManager.onData = async (buffer) => {
      try {
        this.audioChunkCount++;
        if (this.audioChunkCount <= 3 || this.audioChunkCount % 10 === 0) {
          console.log(`🎵 Audio chunk #${this.audioChunkCount} captured (${buffer.length} bytes)`);
        }
        const base64Audio = buffer.toString('base64');
        await this.geminiService.sendAudio(base64Audio);
        if (this.audioChunkCount % 30 === 0) {
          console.log(`📤 Sent ${this.audioChunkCount} audio chunks to Gemini`);
        }
      } catch (err) {
        console.error('❌ Failed to send audio to Gemini:', err);
      }
    };

    // Connect to Gemini
    console.log('📋 Step 5: Connecting to Gemini...');
    await this.geminiService.connect();
    this.isRunning = true;
    console.log('\n✅ VisionClaw audio session FULLY STARTED');
    console.log('🎤 Microphone is active - speak now!\n');
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
          console.log(`🔨 Executing task: ${task.substring(0, 100)}`);
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