const express = require('express');
const crypto = require('crypto');
const { getDatabase } = require('../db/database');
const { createCheckout, getCustomerPortalUrl } = require('../services/lemonSqueezyService');

const router = express.Router();

// GET /api/billing/status — current user's plan & subscription details
router.get('/status', async (req, res) => {
  const db = await getDatabase();
  const user = await db.get(
    'SELECT plan, ls_customer_id, ls_subscription_id, ls_subscription_status FROM users WHERE id = ?',
    [req.user.id],
  );
  const plan = user?.plan || 'free';
  const status = user?.ls_subscription_status || null;
  res.json({
    plan,
    subscriptionStatus: status,
    isPro: plan === 'pro' && (!status || ['active', 'cancelled'].includes(status)),
    hasCustomer: !!user?.ls_customer_id,
  });
});

// POST /api/billing/checkout — create a LemonSqueezy checkout URL
// Body: { billingCycle: 'monthly' | 'annual' }
router.post('/checkout', async (req, res) => {
  const billingCycle = req.body?.billingCycle === 'annual' ? 'annual' : 'monthly';
  const db = await getDatabase();
  const user = await db.get('SELECT id, email, name FROM users WHERE id = ?', [req.user.id]);
  const url = await createCheckout({ userId: user.id, email: user.email, name: user.name, billingCycle });
  res.json({ url });
});

// POST /api/billing/portal — get customer portal URL (pro users)
router.post('/portal', async (req, res) => {
  const db = await getDatabase();
  const user = await db.get('SELECT ls_customer_id FROM users WHERE id = ?', [req.user.id]);
  if (!user?.ls_customer_id) {
    return res.status(400).json({ error: 'No billing account found. Please subscribe first.' });
  }
  const url = await getCustomerPortalUrl(user.ls_customer_id);
  if (!url) {
    return res.status(502).json({ error: 'Could not retrieve billing portal URL from LemonSqueezy.' });
  }
  res.json({ url });
});

// Webhook handler — exported separately so server.js can mount it with raw body parsing
// before the global express.json() middleware.
async function handleWebhook(req, res) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[billing] LEMONSQUEEZY_WEBHOOK_SECRET is not set');
    return res.status(500).send('Webhook secret not configured');
  }

  const sig = req.headers['x-signature'];
  if (!sig) return res.status(401).send('Missing x-signature header');

  const rawBody = req.body; // Buffer — provided by express.raw()
  const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  if (sig !== digest) return res.status(401).send('Invalid signature');

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).send('Invalid JSON body');
  }

  const eventName = event.meta?.event_name;
  const userId = event.meta?.custom_data?.user_id;
  const attrs = event.data?.attributes;
  const customerId = String(event.data?.relationships?.customer?.data?.id ?? '');
  const subscriptionId = String(event.data?.id ?? '');

  console.log(`[billing] ${eventName}  user=${userId}  sub=${subscriptionId}  status=${attrs?.status}`);

  try {
    const db = await getDatabase();

    switch (eventName) {
      case 'subscription_created':
        if (!userId) {
          console.error('[billing] subscription_created: missing user_id in custom_data');
          break;
        }
        await db.run(
          `UPDATE users SET plan = 'pro', ls_customer_id = ?, ls_subscription_id = ?, ls_subscription_status = ? WHERE id = ?`,
          [customerId, subscriptionId, attrs?.status ?? 'active', userId],
        );
        break;

      case 'subscription_updated':
        if (attrs?.status) {
          await db.run(
            'UPDATE users SET ls_subscription_status = ? WHERE ls_subscription_id = ?',
            [attrs.status, subscriptionId],
          );
          if (attrs.status === 'expired') {
            await db.run(
              `UPDATE users SET plan = 'free' WHERE ls_subscription_id = ?`,
              [subscriptionId],
            );
          }
        }
        break;

      case 'subscription_cancelled':
        await db.run(
          `UPDATE users SET ls_subscription_status = 'cancelled' WHERE ls_subscription_id = ?`,
          [subscriptionId],
        );
        break;

      case 'subscription_expired':
        await db.run(
          `UPDATE users SET plan = 'free', ls_subscription_status = 'expired' WHERE ls_subscription_id = ?`,
          [subscriptionId],
        );
        break;

      default:
        // Ignore other events (order_created, etc.)
        break;
    }
  } catch (err) {
    console.error('[billing] webhook DB error:', err);
    return res.status(500).send('Internal error');
  }

  res.status(200).send('OK');
}

module.exports = { router, handleWebhook };
