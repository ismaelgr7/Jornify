/// <reference types="vite/client" />
import { supabase, supabaseUrl } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || supabaseUrl;

/**
 * Create a Stripe Checkout session for subscription
 */
export async function createCheckoutSession(
    companyId: string,
    companyEmail: string,
    employeeCount: number
): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
            companyId,
            companyEmail,
            employeeCount,
            returnUrl: window.location.origin, // Send current origin explicitly
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        let errorMsg = `Error ${response.status}: ${text}`;
        try {
            const json = JSON.parse(text);
            if (json.error) errorMsg = json.error;
        } catch (e) {
            // Not JSON
        }
        console.error('Create Checkout Error:', errorMsg);
        throw new Error(errorMsg);
    }

    const { url } = await response.json();
    return url;
}

/**
 * Create a Stripe Customer Portal session
 */
export async function createPortalSession(customerId: string): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch(`${SUPABASE_URL}/functions/v1/customer-portal`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
            customerId,
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        let errorMsg = `Error ${response.status}: ${text}`;
        try {
            const json = JSON.parse(text);
            if (json.error) errorMsg = json.error;
        } catch (e) {
            // Not JSON
        }
        console.error('Portal Session Error:', errorMsg);
        throw new Error(errorMsg);
    }

    const { url } = await response.json();
    return url;
}

/**
 * Update subscription quantity (number of employees)
 */
export async function updateSubscriptionQuantity(
    subscriptionId: string,
    quantity: number
): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch(`${SUPABASE_URL}/functions/v1/update-subscription`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
            subscriptionId,
            quantity,
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        console.error('Update Subscription Error:', text);
        throw new Error(`Error ${response.status}: ${text}`);
    }
}
