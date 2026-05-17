'use strict';
const React = require('react');
const { useState, useEffect } = require('react');
const { Box, Text, useInput } = require('ink');
const os = require('os');

const ChatMessage = require('./ChatMessage');

const MAX_HISTORY = 40;

const Terminal = ({ cfg, onExit }) => {
  const [input, setInput] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { text: cfg.welcome || `Welcome ${cfg.name}! Type help for commands.`, type: 'system' }
  ]);
  const [cwd, setCwd] = useState(process.cwd());

  useInput((input, key) => {
    if (key.return) {
      handleSubmit();
    } else if (key.backspace) {
      setInput((prev) => prev.slice(0, -1));
    } else if (key.delete) {
      setInput('');
    } else if (input) {
      setInput((prev) => prev + input);
    }
  });

  const handleSubmit = async () => {
    if (!input.trim()) return;

    const cmd = input.trim();
    setChatHistory((prev) => [...prev, { text: cmd, type: 'user' }]);
    setInput('');

    if (cmd === 'exit' || cmd === 'quit') {
      onExit();
      return;
    }

    if (cmd === 'help') {
      setChatHistory((prev) => [
        ...prev,
        {
          text: `ShellMax Commands:

Apps & Files:
  open <appname>       Launch any installed app
  open <file.ext>      Find and open a file
  crt ws <name>...    Create a workspace
  listapps             Show all detected apps

Messaging:
  connect wa|dc|tg|ig Connect a messaging platform
  msg wa <name> <txt> Send WhatsApp message

System:
  st                   Open settings
  name <name>          Change display name
  exit / quit          Exit ShellMax`,
          type: 'shellmax'
        }
      ]);
      return;
    }

    if (cmd.startsWith('cd ')) {
      const newDir = cmd.slice(3).trim();
      try {
        process.chdir(newDir);
        setCwd(process.cwd());
      } catch (e) {
        setChatHistory((prev) => [...prev, { text: `Error: ${e.message}`, type: 'shellmax' }]);
      }
      return;
    }

    try {
      const { execSync } = require('child_process');
      const output = execSync(cmd, { cwd: cwd, encoding: 'utf8', timeout: 10000 });
      setChatHistory((prev) => [...prev, { text: output || '(no output)', type: 'shellmax' }]);
    } catch (e) {
      setChatHistory((prev) => [...prev, { text: e.message, type: 'shellmax' }]);
    }

    while (chatHistory.length > MAX_HISTORY) {
      setChatHistory((prev) => prev.slice(1));
    }
  };

  return (
    <Box flexDirection="column" height={process.stdout.rows}>
      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        {chatHistory.map((msg, i) => (
          <ChatMessage key={i} text={msg.text} type={msg.type} />
        ))}
      </Box>

      <Box borderStyle="round" borderColor="gray" padding={1} flexShrink={0}>
        <Text color="magenta">{'>'}</Text>
        <Text> </Text>
        <Text>{input}<Text color="cyan">_</Text></Text>
      </Box>

      <Box>
        <Text color="gray">cwd: {cwd.replace(os.homedir(), '~')}</Text>
      </Box>
    </Box>
  );
};

module.exports = Terminal;