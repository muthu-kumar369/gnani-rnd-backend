You are updating my Gnani backend project that runs inside WSL using Node.js and Python.
You must analyze the entire project directory and automatically find:

- all Node.js files
- all Python files
- all shell scripts
- any setup or install scripts

Do not ask me for file names — detect everything yourself.

---

## **Your tasks**

### **1. Fix Python interpreter usage in Node.js**

Scan all JS files and update every place where the backend uses:

`spawn("python", ...)`

Change it to:

`spawn("python3", ...)`

This includes any service, utility, or runner you find.

---

### **2. Find the correct installation/setup shell script**

There may be multiple `.sh` files.
Identify the one(s) responsible for environment setup and update them.

Add the necessary WSL Python and system dependencies:

```
sudo apt update
sudo apt install -y \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    build-essential \
    libsndfile1 \
    ffmpeg
```

Then install the required Python packages:

```
pip install numpy
pip install soundfile
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
pip install openai-whisper
pip install TTS
pip install gTTS
pip install pyttsx3
```

---

### **3. Add a Python dependency test block**

Append this to the install script you update:

```
python3 - << 'EOF'
import numpy
import soundfile
import torch
import whisper
print("Python dependencies installed successfully!")
EOF
```

---

### **4. Update all Python runner files**

Scan all `.py` files and ensure they:

- do not assume the `python` interpreter
- work correctly under `python3`
- are compatible with Whisper and TTS

Fix anything necessary.

---

### **5. Ensure the installation works fully inside WSL**

Make sure all commands, pip installs, and system packages run in Linux (WSL), not Windows.

---

## **6. Final Output Required**

After analyzing and updating everything, show me:

- All updated Node.js `spawn` sections
- The updated installation shell script
- Updated Python runner logic
- A short summary of what you fixed and improved

Make the final output clean, organized, and production-ready.
