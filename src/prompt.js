'use strict';
const { session } = require('./config');

// Ask a question using the EXISTING main readline — no new interface, no conflict.
// rl.question() is the correct API for this: it pauses the line event,
// waits for one answer, then resumes. Exactly what we need.
function ask(question) {
  return new Promise((resolve) => {
    const rl = session.rl;

    if (rl) {
      // Use the main terminal rl directly
      rl.question(question, (answer) => {
        resolve(answer);
      });
    } else {
      // Onboarding path: rl not created yet, use a temp one
      const readline = require('readline');
      const tmp = readline.createInterface({ input: process.stdin, output: process.stdout });
      tmp.question(question, (answer) => { tmp.close(); resolve(answer); });
    }
  });
}

module.exports = { ask };
