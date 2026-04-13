/**
 * One-time (or re-) authorization: prints URL, user pastes code, writes token.json.
 * Run: cd backend && npm run auth
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { createOAuthClient, SCOPES, tokenPath, credentialsPath } = require('../services/calendarService');

async function main() {
  if (!fs.existsSync(credentialsPath())) {
    console.error('Missing backend/credentials.json — download OAuth Desktop JSON from Google Cloud Console.');
    process.exit(1);
  }

  const oauth2Client = createOAuthClient();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });

  console.log('\nOpen this URL in your browser, sign in, and approve access:\n');
  console.log(url);
  console.log('\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const code = await new Promise((resolve) => {
    rl.question('Paste the authorization code here: ', resolve);
  });
  rl.close();

  try {
    const { tokens } = await oauth2Client.getToken(code.trim());
    fs.writeFileSync(tokenPath(), JSON.stringify(tokens, null, 2), 'utf8');
    console.log(`\nSaved tokens to ${tokenPath()}\n`);
  } catch (e) {
    console.error('Token exchange failed:', e.message);
    process.exit(1);
  }
}

main();
