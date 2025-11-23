// websocket_test.js
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000'); // Connect to your server

socket.on('connect', () => {
  console.log('Connected to WebSocket server!');

  // Send an assistant request
  socket.emit('assistantRequest', { message: 'Hello from client!' });
});

socket.on('assistantResponse', (data) => {
  console.log('Received assistant response:', data);
  socket.disconnect(); // Disconnect after receiving response
});

socket.on('disconnect', () => {
  console.log('Disconnected from WebSocket server.');
});

socket.on('connect_error', (err) => {
  console.error('WebSocket connection error:', err.message);
});