const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Startup message
console.log(JSON.stringify({
  type: 'text',
  content: 'Test agent started'
}));

rl.on('line', (line) => {
  try {
    const msg = JSON.parse(line);
    
    if (msg.type === 'message') {
      console.log(JSON.stringify({
        type: 'text',
        content: `Received: ${msg.content}`
      }));
    }
  } catch (e) {
    console.log(JSON.stringify({
      type: 'text',
      content: 'Invalid JSON received'
    }));
  }
});
