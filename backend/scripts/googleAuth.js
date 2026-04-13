/**
 * One-time (or re-) authorization: prints URL, user pastes code, writes token.json.
 * Run: cd backend && npm run auth
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { createOAuthClient, SCOPES, tokenPath, credentialsPath } = require('../services/calendarService');

async function main() {
  const credsFile = credentialsPath();
  if (!fs.existsSync(credsFile)) {
    console.error(
      'Missing OAuth client file.\n\n' +
        '1) Google Cloud Console → APIs & Services → Credentials\n' +
        '2) Create OAuth client ID → Application type: Desktop app\n' +
        '3) Download JSON and save it as:\n\n' +
        `   ${credsFile}\n\n` +
        '(Same folder as backend/package.json — name must be credentials.json)',
    );
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
