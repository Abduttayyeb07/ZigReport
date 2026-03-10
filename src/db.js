const { Pool } = require('pg');
const { Client: SSHClient } = require('ssh2');
const net = require('net');
const fs = require('fs');
const path = require('path');

let pool = null;
let sshClient = null;
let tunnelServer = null;

/**
 * Create an SSH tunnel and return the local port to connect through.
 */
function createTunnel() {
  return new Promise((resolve, reject) => {
    const ssh = new SSHClient();

    const sshConfig = {
      host: process.env.SSH_HOST,
      port: parseInt(process.env.SSH_PORT, 10) || 22,
      username: process.env.SSH_USER,
      readyTimeout: 15000,
    };

    // Use private key file for authentication
    if (process.env.SSH_PRIVATE_KEY_PATH) {
      const keyPath = process.env.SSH_PRIVATE_KEY_PATH.replace(/^~/, process.env.HOME || process.env.USERPROFILE);
      sshConfig.privateKey = fs.readFileSync(path.resolve(keyPath));
      if (process.env.SSH_PASSPHRASE) {
        sshConfig.passphrase = process.env.SSH_PASSPHRASE;
      }
    }

    ssh.on('ready', () => {
      console.log('[SSH] Tunnel connected');

      const server = net.createServer((sock) => {
        ssh.forwardOut(
          sock.remoteAddress || '127.0.0.1',
          sock.remotePort || 0,
          process.env.DB_HOST || '127.0.0.1',
          parseInt(process.env.DB_PORT, 10) || 5432,
          (err, stream) => {
            if (err) {
              sock.end();
              return;
            }
            sock.pipe(stream).pipe(sock);
          }
        );
      });

      server.listen(0, '127.0.0.1', () => {
        const localPort = server.address().port;
        console.log(`[SSH] Tunnel listening on 127.0.0.1:${localPort} → ${process.env.DB_HOST}:${process.env.DB_PORT}`);
        tunnelServer = server;
        sshClient = ssh;
        resolve(localPort);
      });
    });

    ssh.on('error', (err) => {
      console.error('[SSH] Connection error:', err.message);
      reject(err);
    });

    ssh.connect(sshConfig);
  });
}

/**
 * Initialize SSH tunnel + PostgreSQL pool.
 */
async function init() {
  const localPort = await createTunnel();

  pool = new Pool({
    host: '127.0.0.1',
    port: localPort,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: false,
  });

  pool.on('error', (err) => {
    console.error('[DB] Unexpected pool error:', err.message);
  });

  return pool;
}

/**
 * Execute a query against the database.
 */
async function query(text, params) {
  if (!pool) throw new Error('Database not initialized. Call init() first.');
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log(`[DB] Query executed in ${duration}ms — ${result.rowCount} rows`);
  return result;
}

/**
 * Close pool, tunnel server, and SSH connection.
 */
async function close() {
  if (pool) {
    await pool.end();
    console.log('[DB] Pool closed');
  }
  if (tunnelServer) {
    tunnelServer.close();
    console.log('[SSH] Tunnel server closed');
  }
  if (sshClient) {
    sshClient.end();
    console.log('[SSH] Connection closed');
  }
}

module.exports = { init, query, close };
