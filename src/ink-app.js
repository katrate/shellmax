import React, { createElement as h } from 'react';
import { render, Box, Text } from 'ink';

const App = () => h(Box, { flexDirection: 'column' },
	h(Text, null, 'Hello from Ink!'),
	h(Text, { color: 'green' }, 'This is green text'),
	h(Text, { color: 'magenta' }, 'This is magenta')
);

render(h(App));