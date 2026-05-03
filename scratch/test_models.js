const https = require('https');
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.models) {
        console.log("Available models:");
        parsed.models.forEach(m => {
          if (m.supportedGenerationMethods.includes('generateContent')) {
            console.log(`- ${m.name}`);
          }
        });
      } else {
        console.log("No models found:", parsed);
      }
    } catch (e) {
      console.error("Parse error:", e.message);
      console.log("Raw data:", data);
    }
  });
}).on('error', (err) => {
  console.error("Request error:", err.message);
});
