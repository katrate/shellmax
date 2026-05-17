'use strict';
const React = require('react');
const { Text, Box } = require('ink');

const ChatMessage = ({ text, type }) => {
  const isUser = type === 'user';
  const isShellMax = type === 'shellmax';

  const label = isUser ? 'You' : isShellMax ? 'ShellMax' : '•';
  const alignRight = isUser;

  return (
    <Box flexDirection="column">
      {text.split('\n').map((line, i) => (
        <Box key={i} justifyContent={alignRight ? 'flex-end' : 'flex-start'}>
          <Text>
            <Text color={isUser ? 'magenta' : isShellMax ? 'green' : 'gray'}>
              {label}
            </Text>
            {'  '}
            <Text color="gray">{line}</Text>
          </Text>
        </Box>
      ))}
      <Box height={1} />
    </Box>
  );
};

module.exports = ChatMessage;