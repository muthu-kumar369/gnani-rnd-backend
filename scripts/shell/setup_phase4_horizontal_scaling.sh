#!/bin/bash

# scripts/shell/setup_phase4_horizontal_scaling.sh
# Setup Horizontal Scaling for Phase 4

echo "========================================="
echo "Setting up Horizontal Scaling..."
echo "========================================="

# Check for Nginx
echo ""
echo "Checking for Nginx..."
if command -v nginx &> /dev/null; then
  echo "✅ Nginx is installed"
  nginx -v
else
  echo "⚠️  Nginx is not installed"
  echo ""
  echo "Installation instructions:"
  echo "  Ubuntu/Debian: sudo apt-get install -y nginx"
  echo "  macOS: brew install nginx"
  echo "  Windows: Download from https://nginx.org/en/download.html"
  echo ""
  read -p "Would you like to continue without Nginx? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Create Nginx config directory
echo ""
echo "Creating Nginx configuration directory..."
mkdir -p nginx

# Create logs directory for multi-instance
echo ""
echo "Creating logs directory..."
mkdir -p logs

# Test Nginx configuration (if Nginx is installed and config exists)
if command -v nginx &> /dev/null && [ -f "nginx/nginx.conf" ]; then
  echo ""
  echo "Testing Nginx configuration..."
  nginx -t -c $(pwd)/nginx/nginx.conf
  if [ $? -eq 0 ]; then
    echo "✅ Nginx configuration is valid"
  else
    echo "⚠️  Nginx configuration has errors"
  fi
fi

echo ""
echo "========================================="
echo "✅ Horizontal scaling setup complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Configure nginx/nginx.conf for your setup"
echo "2. Start multiple instances: bash scripts/shell/start_multi_instance.sh"
echo "3. Test load balancing"
echo ""
