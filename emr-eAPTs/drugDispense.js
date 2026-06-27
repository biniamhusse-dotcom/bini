'use strict';

const express = require('express');
const medUtils = require('openhim-mediator-utils');
const winston = require('winston');
const dotenv = require('dotenv');
const path = require('path');

// Resolve the directory of .env file
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Logging setup
winston.remove(winston.transports.Console);
winston.add(new winston.transports.Console({ level: 'info', timestamp: true, colorize: true }));

// Config
let config = {}; // This will vary depending on what's set in openhim-core

// If on test environment, fetch from ./config/test; otherwise, fetch from ./config/config
const apiConf = process.env.NODE_ENV === 'test' ? require('./config/test') : require('./config/config');
const mediatorConfig = require('./config/mediator');
const { response } = require('express');

// Fetch port from endpoint configuration (3006)
const port = process.env.NODE_ENV === 'test' ? 7001 : mediatorConfig.endpoints[3].port

/**
 * setupApp - configures the HTTP server for this mediator
 *
 * @return {express.App} the configured HTTP server
 */
function setupApp() {
  const app = express();
  app.use('/', require('./routes'));
  return app;
}

/**
 * start - starts the mediator
 *
 * @param {Function} callback a Node.js-style callback that is called once the server is started
 */
function start(callback) {
  if (apiConf.api.trustSelfSigned) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  function handleMediatorRegistrationError(err) {
    winston.error('Failed to register this mediator, check your config');
    winston.error(err.stack);
    process.exit(1);
  }

  function handleConfigFetchError(err) {
    winston.error('Failed to fetch initial config');
    winston.error(err.stack);
    process.exit(1);
  }

  function handleConfigUpdate(newConfig) {
    winston.info('Received updated config:');
    winston.info(JSON.stringify(newConfig));
    // Set new config for mediator
    config = newConfig;
    // We can act on the new config received from the OpenHIM here
    winston.info(config);
  }

  if (apiConf.register) {
    medUtils.registerMediator(apiConf.api, mediatorConfig, (err) => {
      if (err) {
        handleMediatorRegistrationError(err);
      }
      apiConf.api.urn = mediatorConfig.urn;
      medUtils.fetchConfig(apiConf.api, (err, newConfig) => {
        winston.info('Received initial config:');
        winston.info(JSON.stringify(newConfig));
        config = newConfig;
        if (err) {
          handleConfigFetchError(err);
        } else {
          winston.info('Successfully registered mediator!');
          const app = setupApp();
          const server = app.listen(port, () => {
            if (apiConf.heartbeat) {
              const configEmitter = medUtils.activateHeartbeat(apiConf.api);
              configEmitter.on('config', handleConfigUpdate);
            }
            callback(server);
          });
        }
      });
    });
  } else {
    // Default to config from mediator registration
    config = mediatorConfig.config;
    const app = setupApp();
    const server = app.listen(port, () => callback(server));
  }
}

exports.start = start;

if (!module.parent) {
  // If this script is run directly, start the server
  start(() => winston.info(`Listening on ${port}...`));
}
