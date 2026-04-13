/**
 * Read/write root config.json for the Settings page.
 */
const express = require('express');
const { readConfig, writeConfig } = require('../services/configService');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(readConfig());
});

router.put('/', (req, res) => {
  if (!req.body || typeof req.body !== 'object') {
    const err = new Error('JSON body required');
    err.status = 400;
    throw err;
  }
  writeConfig(req.body);
  res.json(readConfig());
});

module.exports = router;
