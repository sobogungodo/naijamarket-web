// src/lib/push-notifications.ts
// Server-side utility for sending push notifications

import webPush from 'web-push';
import { prisma } from '@/lib/prisma';

// Configure web-push with VAPID keys
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY!;
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@naijamarketintel.ng';

if (vapidPublicKey && vapidPrivateKey) {
  webPush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
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

// Send notification to a specific user
export async function sendPushToUser(
  userId: string,
  payload: PushNotificationPayload
): Promise<{ success: number; failed: number }> {
  const subscriptions = await prisma.push_Subscription.findMany({
    where: {
      user_id: userId,
      is_active: true
    }
  });
  
  if (subscriptions.length === 0) {
    console.log(`[Push] No active subscriptions for user ${userId}`);
    return { success: 0, failed: 0 };
  }
  
  let success = 0;
  let failed = 0;
  
  for (const sub of subscriptions) {
    try {
      await webPush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh_key,
            auth: sub.auth_key
          }
        },
        JSON.stringify(payload)
      );
      success++;
    } catch (error: any) {
      console.error(`[Push] Failed to send to ${sub.endpoint}:`, error.message);
      failed++;
      
      // If subscription is invalid, mark as inactive
      if (error.statusCode === 404 || error.statusCode === 410) {
        await prisma.push_Subscription.update({
          where: { id: sub.id },
          data: { is_active: false }
        });
        console.log(`[Push] Marked subscription ${sub.id} as inactive`);
      }
    }
  }
  
  return { success, failed };
}

// Send notification to multiple users
export async function sendPushToUsers(
  userIds: string[],
  payload: PushNotificationPayload
): Promise<{ success: number; failed: number }> {
  let totalSuccess = 0;
  let totalFailed = 0;
  
  for (const userId of userIds) {
    const result = await sendPushToUser(userId, payload);
    totalSuccess += result.success;
    totalFailed += result.failed;
  }
  
  return { success: totalSuccess, failed: totalFailed };
}

// Send price alert notification
export async function sendPriceAlert(
  userId: string,
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
  
  const result = await sendPushToUser(userId, payload);
  return result.success > 0;
}

// Send validation request notification (for validators)
export async function sendValidationRequest(
  validatorId: string,
  submissionId: string,
  itemName: string,
  marketName: string,
  traderName: string
): Promise<boolean> {
  const payload: PushNotificationPayload = {
    title: '🔔 New Validation Request',
    body: `${traderName} submitted ${itemName} price at ${marketName}. Please verify.`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: `validation-${submissionId}`,
    data: {
      url: `/validate/${submissionId}`,
      type: 'validation_request',
      submission_id: submissionId
    },
    actions: [
      { action: 'validate', title: 'Validate Now', icon: '/icons/action-view.png' },
      { action: 'later', title: 'Later', icon: '/icons/action-dismiss.png' }
    ],
    requireInteraction: true
  };
  
  const result = await sendPushToUser(validatorId, payload);
  return result.success > 0;
}

// Send reward notification
export async function sendRewardNotification(
  userId: string,
  amount: number,
  reason: 'submission' | 'validation'
): Promise<boolean> {
  const reasonText = reason === 'submission' 
    ? 'approved price submission' 
    : 'validation vote';
  
  const payload: PushNotificationPayload = {
    title: '💰 Reward Earned!',
    body: `You earned ₦${amount} for your ${reasonText}. Keep it up!`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: 'reward-notification',
    data: {
      url: '/rewards',
      type: 'reward',
      amount: amount
    }
  };
  
  const result = await sendPushToUser(userId, payload);
  return result.success > 0;
}

// Broadcast to all users (use sparingly!)
export async function broadcastPush(
  payload: PushNotificationPayload,
  options?: {
    limit?: number;
    excludeUserIds?: string[];
  }
): Promise<{ success: number; failed: number; total: number }> {
  const where: any = { is_active: true };
  
  if (options?.excludeUserIds?.length) {
    where.user_id = { notIn: options.excludeUserIds };
  }
  
  const subscriptions = await prisma.push_Subscription.findMany({
    where,
    take: options?.limit || 1000,
    distinct: ['user_id']
  });
  
  let success = 0;
  let failed = 0;
  
  // Process in batches of 100 to avoid overwhelming the push service
  const batchSize = 100;
  for (let i = 0; i < subscriptions.length; i += batchSize) {
    const batch = subscriptions.slice(i, i + batchSize);
    
    await Promise.all(
      batch.map(async (sub) => {
        try {
          await webPush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh_key,
                auth: sub.auth_key
              }
            },
            JSON.stringify(payload)
          );
          success++;
        } catch (error: any) {
          failed++;
          
          if (error.statusCode === 404 || error.statusCode === 410) {
            await prisma.push_Subscription.update({
              where: { id: sub.id },
              data: { is_active: false }
            });
          }
        }
      })
    );
    
    // Small delay between batches
    if (i + batchSize < subscriptions.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log(`[Push] Broadcast complete: ${success} success, ${failed} failed, ${subscriptions.length} total`);
  
  return { success, failed, total: subscriptions.length };
}
