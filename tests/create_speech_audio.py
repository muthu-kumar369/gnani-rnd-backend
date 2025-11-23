# create_speech_audio.py
import numpy as np
from scipy.io.wavfile import write
import os
import wavio

samplerate = 16000 # 16kHz
duration = 2       # 2 seconds
frequency1 = 440   # A4 note
frequency2 = 660   # E5 note (for a more complex sound)

# Generate two sine waves and mix them to simulate speech-like complexity
t = np.linspace(0., duration, int(samplerate * duration), endpoint=False)
amplitude = np.iinfo(np.int16).max * 0.3 # Reduced amplitude to avoid clipping with mixing
data1 = amplitude * np.sin(2. * np.pi * frequency1 * t)
data2 = amplitude * np.sin(2. * np.pi * frequency2 * t)

# Simple mix (add them)
mixed_data = data1 + data2

# Introduce some variability (e.g., amplitude modulation or simple noise)
# For a truly "speech-like" signal for Whisper, this would be much more complex.
# For now, let's keep it simple.
# mixed_data += np.random.normal(0, np.iinfo(np.int16).max * 0.05, mixed_data.shape) # Add some noise

output_file = "dummy_speech.wav"
write(output_file, samplerate, mixed_data.astype(np.int16))

print(f"Created {output_file}")