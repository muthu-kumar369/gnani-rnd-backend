# Implementation Prompt: Text-Based TTS Streaming

## Objective
Modify the backend to send **TEXT responses** instead of **TTS audio chunks** so the frontend can use Web Speech API for text-to-speech.

## Current Problem
- Backend sends `stream:tts_chunk` with PCM audio data
- Frontend treats this audio as text, causing garbled speech
- Results in repeated "ACK" and "I am not the real man" sounds
- Queue builds up to 389-862 utterances

## Required Changes

### 1. Remove TTS Audio Generation
**Files to modify:** Wherever TTS audio is currently generated and sent

**Current behavior:**
```python
# Backend currently does something like:
tts_audio = generate_tts_audio(text)
send_message({
    "type": "tts_chunk",
    "segment_id": session_id,
    "pcm_base64": base64.b64encode(tts_audio),
    "sampleRate": 16000,
    "format": "pcm_s16le"
})
```

**Remove:** All TTS audio generation and encoding logic

### 2. Add New Message Type: `stream:llm_chunk`
**Purpose:** Send LLM-generated text to frontend for Web Speech API

**Message format:**
```python
{
    "type": "llm_chunk",
    "text": "Hello! How can I help you?",  # The actual text to speak
    "segment_id": session_id  # Optional: for tracking
}
```

### 3. Stream LLM Text as Generated
**Implementation:**

```python
# Example: Stream LLM response as it's generated
async def stream_llm_response(session_id, user_input):
    # Get LLM stream
    llm_stream = get_llm_response_stream(user_input)
    
    # Stream each chunk to frontend
    for chunk in llm_stream:
        # Send text chunk immediately
        await send_to_frontend({
            "type": "llm_chunk",
            "text": chunk,  # e.g., "Hello! ", "How can ", "I help you?"
            "segment_id": session_id
        })
    
    # Optionally send end marker
    await send_to_frontend({
        "type": "llm_end",
        "segment_id": session_id
    })
```

### 4. Keep Existing STT Messages (No Changes)
These should continue working as-is:
- `stream:partial` - Partial transcription
- `stream:final` - Final transcription

## Implementation Steps

### Step 1: Locate TTS Audio Code
Find where the backend currently:
1. Generates TTS audio from text
2. Encodes it to PCM/base64
3. Sends `stream:tts_chunk` messages

**Search for:**
- `tts_chunk`
- `pcm_base64`
- TTS generation functions
- Audio encoding logic

### Step 2: Replace with Text Streaming
Instead of generating audio, send the text directly:

**Before:**
```python
text = llm_response
tts_audio = text_to_speech(text)  # Remove this
send_tts_chunk(tts_audio)  # Remove this
```

**After:**
```python
text = llm_response
send_llm_chunk(text)  # Send text directly
```

### Step 3: Update Message Sender
Modify the function that sends messages to frontend:

```python
def send_llm_chunk(text, segment_id):
    """Send LLM text chunk to frontend for TTS"""
    message = {
        "type": "llm_chunk",
        "text": text,
        "segment_id": segment_id
    }
    # Send via your gRPC/WebSocket/HTTP stream
    send_to_frontend(message)
```

### Step 4: Handle Streaming
If using streaming LLM (e.g., OpenAI streaming):

```python
# Example with OpenAI streaming
for chunk in openai_stream:
    if chunk.choices[0].delta.content:
        text_chunk = chunk.choices[0].delta.content
        send_llm_chunk(text_chunk, session_id)
```

### Step 5: Test
1. Start backend
2. Send audio from frontend
3. Verify backend sends `stream:llm_chunk` with text
4. Check frontend console for: `[IPC] Received LLM text chunk: ...`
5. Verify Web Speech API speaks the text

## Expected Message Flow

```
User speaks → Frontend sends audio
                ↓
Backend receives audio → Whisper transcription
                ↓
Backend sends: stream:partial (optional)
Backend sends: stream:final (transcription)
                ↓
LLM processes → Generates text response
                ↓
Backend sends: stream:llm_chunk (text chunk 1)
Backend sends: stream:llm_chunk (text chunk 2)
Backend sends: stream:llm_chunk (text chunk 3)
...
Backend sends: stream:llm_end (optional)
                ↓
Frontend receives text → Web Speech API speaks it
```

## Verification Checklist

- [ ] Removed all TTS audio generation code
- [ ] Removed `stream:tts_chunk` message sending
- [ ] Added `stream:llm_chunk` message type
- [ ] LLM text is streamed as generated
- [ ] Message format matches: `{ type: "llm_chunk", text: "...", segment_id: "..." }`
- [ ] Tested with frontend - no more garbled audio
- [ ] Tested with frontend - Web Speech API speaks correctly
- [ ] No "ACK" or repeated sounds

## Benefits

1. **Simpler pipeline** - No audio encoding/decoding
2. **Smaller bandwidth** - Text is ~100x smaller than audio
3. **Better quality** - Browser native TTS sounds natural
4. **Faster response** - Can start speaking while generating
5. **No artifacts** - No garbled or repeated sounds

## Troubleshooting

**If frontend doesn't speak:**
- Check browser console for `[IPC] Received LLM text chunk`
- Verify message type is exactly `"llm_chunk"`
- Check text field contains actual text, not audio data

**If still getting garbled sounds:**
- Ensure ALL `stream:tts_chunk` sends are removed
- Check no base64 audio data is being sent
- Verify frontend logs show warning for any TTS audio chunks

## Questions?
If you need help with specific files or implementation details, let me know which part of the backend handles TTS and I can provide more specific guidance.
