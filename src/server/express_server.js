// backend/src/server/express_server.js
const express = require('express');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const { PORT } = require('../configs/config'); // Use PORT from config
const logger = require('../utils/logger'); // Updated path for logger
const apiRoutes = require('../routes'); // Import consolidated routes from src/routes/index.js
const errorHandler = require('../utils/error_handler');

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } })); // Log HTTP requests

// Routes
app.use('/api', apiRoutes);

// General endpoint (can remain as is or be removed if all routes are in modular files)
app.get('/', (req, res) => {
    res.send('GNANI Backend is running!');
});

// Error handling middleware
app.use(errorHandler);

const startExpressServer = () => {
    app.listen(PORT, () => {
        logger.info(`Express.js server listening on port ${PORT}`);
    });
};

module.exports = { app, startExpressServer };
