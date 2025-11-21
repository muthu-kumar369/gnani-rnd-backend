#!/bin/bash
# Script to start the development server

echo "Starting GNANI Backend in development mode..."
# Assuming tsx is used for running TypeScript directly for development
# This should watch for changes and restart the server
tsx watch src/index.ts
