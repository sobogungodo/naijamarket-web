// src/lib/push-notifications.ts
// Server-side utility for sending push notifications
// Note: Database integration will be added once push_subscriptions table is created

import webPush from 'web-push';

// Configure web-push with VAPID keys
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@naijamarketintel.ng';

// Only configure if keys are present
if (vapidPublicKey && vapidPrivateKey) {
  try {
    webPush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
    console.log('[Push] VAPID keys configured');
  } catch (error) {
    console.error('[Push] Failed to configure VAPID keys:', error);
  }
}

// Notification payload types
export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: {
    url?: string;
    [key: string]: any;
  };
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  requireInteraction?: boolean;
}

// Send notification to a subscription
export async function sendPushNotification(
  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  },
  payload: PushNotificationPayload
): Promise<boolean> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.error('[Push] VAPID keys not configured');
    return false;
  }

  try {
    await webPush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth
        }
      },
      JSON.stringify(payload)
    );
    return true;
  } catch (error: any) {
    console.error('[Push] Send failed:', error.message);
    return false;
  }
}

// Send price alert notification
export async function sendPriceAlert(
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  },
  itemName: string,
  marketName: string,
  currentPrice: number,
  previousPrice: number,
  change: 'up' | 'down'
): Promise<boolean> {
  const changePercent = Math.abs(((currentPrice - previousPrice) / previousPrice) * 100).toFixed(1);
  const arrow = change === 'up' ? '📈' : '📉';
  const direction = change === 'up' ? 'increased' : 'decreased';

  const payload: PushNotificationPayload = {
    title: `${arrow} Price Alert: ${itemName}`,
    body: `${itemName} has ${direction} by ${changePercent}% at ${marketName}. Now ₦${currentPrice.toLocaleString()}.`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: `price-alert-${itemName.toLowerCase().replace(/\s+/g, '-')}`,
    data: {
      url: `/prices?item=${encodeURIComponent(itemName)}&market=${encodeURIComponent(marketName)}`,
      type: 'price_alert',
      item: itemName,
      market: marketName,
      price: currentPrice,
      change: changePercent
    },
    actions: [
      { action: 'view', title: 'View Prices', icon: '/icons/action-view.png' },
      { action: 'dismiss', title: 'Dismiss', icon: '/icons/action-dismiss.png' }
    ],
    requireInteraction: true
  };

  return sendPushNotification(subscription, payload);
}

// Placeholder for future database integration
export async function sendPushToUser(
  userId: string,
  payload: PushNotificationPayload
): Promise<{ success: number; failed: number }> {
  // TODO: Implement once push_subscriptions table is created
  console.log(`[Push] Would send to user ${userId}:`, payload.title);
  return { success: 0, failed: 0 };
}
