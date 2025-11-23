#!/bin/bash

# Navigate to the project root
cd /mnt/d/AI Project/Gnani/software/gnani-rnd-backend || exit 1

# Activate Python virtual environment (if it exists)
if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
fi

echo "Attempting to start tsx watch src/index.ts..."
# Execute tsx watch and redirect all output to a log file
# Using exec here to replace the current shell process with tsx,
# which can sometimes help with signal handling and process management.
exec tsx watch src/index.ts
