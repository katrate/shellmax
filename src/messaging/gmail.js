'use strict';
const fs    = require('fs');
const path  = require('path');
const os    = require('os');
const chalk = require('chalk');

const CREDS_FILE = path.join(os.homedir(), '.shellmax', 'sessions', 'gmail.json');

// ─── STORAGE ──────────────────────────────────────────────────────────────────
function loadCreds() {
  try { return JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8')); } catch { return null; }
}

function saveCreds(data) {
  fs.mkdirSync(path.dirname(CREDS_FILE), { recursive: true });
  fs.writeFileSync(CREDS_FILE, JSON.stringify(data, null, 2));
}

function ask(rl, q) { return new Promise((res) => rl.question(q, res)); }

// ─── SEND EMAIL ───────────────────────────────────────────────────────────────
async function send(to, subject, body, attachmentPath) {
  const creds = loadCreds();
  if (!creds) throw new Error('Gmail not connected. Run: connect mail');

  const nodemailer = require('nodemailer');

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: creds.email, pass: creds.appPassword },
  });

  const mailOptions = {
    from:    creds.email,
    to,
    subject,
    text:    body,
  };

  if (attachmentPath && fs.existsSync(attachmentPath)) {
    mailOptions.attachments = [{
      filename: path.basename(attachmentPath),
      path:     attachmentPath,
    }];
  }

  await transporter.sendMail(mailOptions);
}

// ─── VIEW EMAILS ──────────────────────────────────────────────────────────────
async function view(filterEmail) {
  const creds = loadCreds();
  if (!creds) throw new Error('Gmail not connected. Run: connect mail');

  const Imap       = require('imap');
  const { simpleParser } = require('mailparser');

  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user:     creds.email,
      password: creds.appPassword,
      host:     'imap.gmail.com',
      port:     993,
      tls:      true,
    });

    const results = [];

    imap.once('ready', () => {
      imap.openBox('INBOX', true, (err) => {
        if (err) { imap.end(); return reject(err); }

        const searchCriteria = filterEmail
          ? [['OR', ['FROM', filterEmail], ['TO', filterEmail]]]
          : [['ALL']];

        imap.search(searchCriteria, (err, uids) => {
          if (err || !uids.length) { imap.end(); return resolve([]); }

          const recent = uids.slice(-5);
          const f = imap.fetch(recent, { bodies: '' });

          f.on('message', (msg) => {
            msg.on('body', (stream) => {
              simpleParser(stream, (err, mail) => {
                if (!err) results.push({
                  from:    mail.from?.text || '?',
                  subject: mail.subject || '(no subject)',
                  body:    (mail.text || '').slice(0, 200),
                  time:    mail.date?.toLocaleString() || '',
                });
              });
            });
          });

          f.once('end', () => { imap.end(); resolve(results); });
        });
      });
    });

    imap.once('error', reject);
    imap.connect();
  });
}

// ─── CONNECT WIZARD ───────────────────────────────────────────────────────────
async function connect() {
  const { ask } = require('../prompt');
  process.stdout.write(chalk.cyan('\n  Gmail uses an App Password (not your main password).\n'));
  process.stdout.write(chalk.gray(
    '  Setup (one-time):\n' +
    '  1. Go to myaccount.google.com → Security\n' +
    '  2. Enable 2-Step Verification (if not already)\n' +
    '  3. Search "App Passwords" → Create one for "Mail"\n' +
    '  4. Copy the 16-character password\n\n'
  ));

  const email       = await ask(chalk.gray('  Gmail address → '));
  const appPassword = await ask(chalk.gray('  App Password (16 chars, no spaces) → '));

  saveCreds({ email: email.trim(), appPassword: appPassword.replace(/\s/g, '') });
  return true;
}

module.exports = { send, view, connect };
