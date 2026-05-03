require('dotenv').config();
const imaps = require('imap-simple');

async function testConnection() {
  const config = {
    imap: {
      user: process.env.GMAIL_USER || 'dattatraydisale75@gmail.com',
      password: process.env.GMAIL_APP_PASSWORD,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 30000
    }
  };

  try {
    console.log('Connecting to IMAP with user:', config.imap.user);
    const connection = await imaps.connect(config);
    console.log('Successfully connected to IMAP!');
    connection.end();
  } catch (error) {
    console.error('Failed to connect:', error.message);
  }
}

testConnection();
