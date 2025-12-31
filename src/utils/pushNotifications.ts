import { supabase } from '../supabaseClient';

const VAPID_PUBLIC_KEY = 'BIrdOPaVIS7pj0g9ffC9zgq7JkAMqQPT1LkGaNdn1q7j1MX1AkxqvREy-i99ew7LP00yGkEDQokAnS6R_1qaYX9U';

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export async function subscribeUserToPush(employeeId: string) {
    try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.warn('Push notifications not supported');
            return;
        }

        const registration = await navigator.serviceWorker.ready;

        // Check if subscription already exists
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                console.warn('Push permission denied');
                return;
            }

            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });
        }

        // Save/Update subscription in Supabase
        const { error } = await supabase
            .from('push_subscriptions')
            .upsert({
                employee_id: employeeId,
                subscription_json: JSON.parse(JSON.stringify(subscription)),
                updated_at: new Date().toISOString()
            });

        if (error) throw error;
        console.log('Push subscription saved successfully');

    } catch (error) {
        console.error('Error subscribing to push:', error);
    }
}
