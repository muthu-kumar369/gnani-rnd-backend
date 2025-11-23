# create_dummy_audio.py
import numpy as np
from scipy.io.wavfile import write
import os

samplerate = 16000 # 16kHz
duration = 1       # 1 second
frequency = 440    # 440 Hz (A4 note)

t = np.linspace(0., duration, int(samplerate * duration), endpoint=False)
amplitude = np.iinfo(np.int16).max * 0.5 # half amplitude for 16-bit PCM
data = amplitude * np.sin(2. * np.pi * frequency * t)

output_file = "dummy_audio.wav"
write(output_file, samplerate, data.astype(np.int16))

print(f"Created {output_file}")