// src/routes/statusRoutes.js
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// Status endpoint (can be public)
router.get('/', (req, res) => { // Note: path changed to '/' as it will be mounted under '/status'
    logger.info('Status endpoint hit');
    res.status(200).send('OK');
});

module.exports = router;
