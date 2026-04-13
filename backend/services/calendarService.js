/**
 * Google Calendar OAuth2 + primary calendar fetch.
 * Timezone: config.timezone (default Africa/Cairo). Skips all-day events.
 */
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { formatInTimeZone } = require('date-fns-tz');
const { DateTime } = require('luxon');
const { enUS } = require('date-fns/locale');
const { readConfig } = require('./configService');

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

function credentialsPath() {
  return path.join(__dirname, '..', 'credentials.json');
}

function tokenPath() {
  return path.join(__dirname, '..', 'token.json');
}

function tokenExists() {
  return fs.existsSync(tokenPath());
}

/**
 * Build OAuth2 client from credentials.json (Desktop client).
 */
function createOAuthClient() {
  const cPath = credentialsPath();
  if (!fs.existsSync(cPath)) {
    const err = new Error(
      'credentials.json not found. Place Google OAuth Desktop JSON in backend/credentials.json (see README).',
    );
    err.status = 400;
    throw err;
  }
  const raw = JSON.parse(fs.readFileSync(cPath, 'utf8'));
  const creds = raw.installed || raw.web;
  if (!creds) {
    throw new Error('credentials.json must contain installed or web OAuth client settings');
  }
  const redirect =
    (creds.redirect_uris && creds.redirect_uris[0]) || 'http://127.0.0.1';
  return new google.auth.OAuth2(creds.client_id, creds.client_secret, redirect);
}

/**
 * Returns an authorized OAuth2 client, refreshing access token as needed.
 */
async function getAuthorizedClient() {
  const oauth2Client = createOAuthClient();
  const tPath = tokenPath();
  if (!fs.existsSync(tPath)) {
    const err = new Error(
      'Google Calendar not connected. Run: npm run auth --workspace=backend (from repo root) or cd backend && npm run auth',
    );
    err.status = 401;
    throw err;
  }
  const tokens = JSON.parse(fs.readFileSync(tPath, 'utf8'));
  oauth2Client.setCredentials(tokens);

  const creds = oauth2Client.credentials;
  if (creds.expiry_date && creds.expiry_date <= Date.now() + 60_000) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      const merged = { ...tokens, ...credentials };
      if (!merged.refresh_token && tokens.refresh_token) {
        merged.refresh_token = tokens.refresh_token;
      }
      oauth2Client.setCredentials(merged);
      fs.writeFileSync(tPath, JSON.stringify(merged, null, 2), 'utf8');
    } catch (e) {
      const err = new Error(`Google token refresh failed: ${e.message}. Run backend npm run auth again.`);
      err.status = 401;
      throw err;
    }
  }

  return oauth2Client;
}

/**
 * Fetch timed events in [fromDate, toDate] inclusive (by local calendar date in config timezone).
 */
async function fetchCalendarEvents(fromDate, toDate) {
  const config = readConfig();
  const tz = config.timezone || 'Africa/Cairo';

  const auth = await getAuthorizedClient();
  const calendar = google.calendar({ version: 'v3', auth });

  const timeMin = DateTime.fromISO(fromDate, { zone: tz }).startOf('day').toUTC().toISO();
  const timeMax = DateTime.fromISO(toDate, { zone: tz }).endOf('day').toUTC().toISO();

  const items = [];
  let pageToken;
  do {
    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      pageToken: pageToken || undefined,
    });
    items.push(...(res.data.items || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  const result = [];
  for (const ev of items) {
    const start = ev.start?.dateTime;
    const end = ev.end?.dateTime;
    if (!start || !end) continue;

    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();
    const durationHours = Math.round(Math.max(0, (endMs - startMs) / 3600000) * 100) / 100;

    const dateStr = formatInTimeZone(new Date(start), tz, 'yyyy-MM-dd');
    const dayOfWeek = formatInTimeZone(new Date(start), tz, 'EEEE', { locale: enUS });

    result.push({
      calendarEventId: ev.id,
      title: ev.summary || '(no title)',
      date: dateStr,
      dayOfWeek,
      startTime: new Date(start).toISOString(),
      endTime: new Date(end).toISOString(),
      durationHours,
    });
  }

  return result;
}

module.exports = {
  fetchCalendarEvents,
  createOAuthClient,
  tokenPath,
  credentialsPath,
  SCOPES,
  tokenExists,
};
