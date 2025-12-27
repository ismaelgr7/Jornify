import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.11.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
})

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Initialize Supabase Admin Client
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SERVICE_ROLE_KEY') ?? ''
        )

        const { companyId } = await req.json()

        if (!companyId) {
            throw new Error('Missing companyId')
        }

        // 1. Get Company Stripe Details
        const { data: company, error: companyError } = await supabase
            .from('companies')
            .select('stripe_customer_id, subscription_id')
            .eq('id', companyId)
            .single()

        if (companyError || !company) {
            throw new Error('Company not found or error fetching details')
        }

        if (!company.subscription_id) {
            // Not subscribed yet, nothing to update
            return new Response(JSON.stringify({ message: 'No active subscription' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            })
        }

        // 2. Count Active Employees (Real Source of Truth)
        // We count ALL employees for this company
        const { count, error: countError } = await supabase
            .from('employees')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', companyId)

        if (countError) {
            throw new Error('Error counting employees')
        }

        const quantity = count || 0

        // 3. Sync with Stripe
        const subscription = await stripe.subscriptions.retrieve(company.subscription_id)

        // Only update if quantity changed
        // We use 'always_invoice' to ensure immediate proration (charge or credit)
        if (subscription.items.data[0].quantity !== quantity && quantity > 0) {
            await stripe.subscriptions.update(company.subscription_id, {
                items: [{
                    id: subscription.items.data[0].id,
                    quantity: quantity,
                }],
                proration_behavior: 'always_invoice',
            })
        }

        return new Response(
            JSON.stringify({ success: true, syncedQuantity: quantity }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        )
    }
})
