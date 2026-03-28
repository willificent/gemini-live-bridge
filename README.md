# Gemini Live Bridge

A bidirectional bridge connecting [Gemini Live API](https://ai.google.dev/gemini-api/docs/live-api/) with [OpenClaw Gateway](https://clawhub.ai).

## Architecture

```
User Voice → Gemini Live API → Bridge (WebSocket) → OpenClaw Gateway (HTTP) → OpenClaw Agent
```

- Gemini Live API receives voice input, transcribes it, and calls tools
- Bridge translates between Gemini's protocol and OpenClaw's HTTP API
- OpenClaw executes the requested tasks and returns results
- Gemini speaks the response to the user

## Features

- ✅ Real-time voice interaction with OpenClaw
- ✅ Single "execute" tool abstraction (Gemini → OpenClaw)
- ✅ Session continuity via OpenClaw session keys
- ✅ Phase 1: Text-based testing (no audio I/O)
- ✅ Phase 2: Audio capture/playback planned

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your API keys and gateway URL
```

Required variables:
- `GEMINI_API_KEY`: Your Gemini API key
- `OPENCLAW_GATEWAY_URL`: Your OpenClaw gateway URL (default: `http://localhost:18789`)
- `OPENCLAW_GATEWAY_TOKEN`: Gateway authentication token
- Optional: `GEMINI_MODEL`, `OPENCLAW_SESSION_KEY`

### 3. Start OpenClaw Gateway

Ensure your OpenClaw gateway is running:
```bash
openclaw gateway status
```

If not running: `openclaw gateway start`

### 4. Start the Bridge

```bash
node src/index.js
```

You'll see: "✅ Bridge ready!"

### 5. Test (Text Mode)

Type your message and press Enter. The bridge will:
1. Send it to Gemini Live
2. Gemini will call the `execute` tool
3. Bridge forwards to OpenClaw
4. Result flows back to Gemini → you see the response

**Example interaction:**
```
Type your messages and press Enter. Ctrl+C to exit.

📤 You: Search my memory for recent emails about the project

🤖 Gemini: I found 3 mentions of "project" in your recent notes...
```

## Project Structure

```
gemini-live-bridge/
├── package.json
├── .env.example
├── README.md
└── src/
    ├── index.js           # Entry point, interactive mode
    ├── gemini-client.js   # WebSocket connection to Gemini
    ├── openclaw-bridge.js # HTTP client for OpenClaw gateway
    ├── tool-router.js     # Routes tool calls → OpenClaw
    ├── tool-declarations.js # Single "execute" tool schema
    └── system-prompt.js   # Gemini system instruction
```

## Implementation Notes

### Gemini Live Protocol
- Uses WebSocket to `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent`
- Setup message includes model, tools, and system instruction
- Binary protobuf encoding will be needed for production (currently using JSON for testing)

### OpenClaw Gateway
- Endpoint: `{OPENCLAW_GATEWAY_URL}/v1/chat/completions`
- Auth: `Authorization: Bearer <token>`
- Session: `x-openclaw-session-key` header for state continuity
- Expects OpenAI-compatible format: `{ model, messages, stream }`

### Tool Abstraction
Gemini sees only one tool: `execute(task: string)`. All OpenClaw capabilities are accessible through this single function. The bridge forwards the task string to OpenClaw's chat completion endpoint, and OpenClaw's agent decides which tools to use internally.

## Phases

- **Phase 1 (Current)**: Text-based test harness, no audio I/O
- **Phase 2**: Add microphone/speaker for real voice (node-speaker, node-microphone)
- **Phase 3**: Refine for production (protobuf encoding, reconnection logic, error handling)
- **Phase 4**: Containerization (Docker)

## License

ISC
