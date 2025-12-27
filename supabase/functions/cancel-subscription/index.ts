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
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SERVICE_ROLE_KEY') ?? ''
        )

        const { companyId } = await req.json()

        if (!companyId) throw new Error('Missing companyId')

        // Get Subscription ID
        const { data: company, error: fetchError } = await supabase
            .from('companies')
            .select('subscription_id')
            .eq('id', companyId)
            .single()

        if (fetchError || !company?.subscription_id) {
            throw new Error('No active subscription found')
        }

        // Cancel in Stripe
        await stripe.subscriptions.cancel(company.subscription_id)

        // Update DB
        const { error: updateError } = await supabase
            .from('companies')
            .update({
                subscription_status: 'canceled',
                subscription_id: null,
                stripe_customer_id: null
            })
            .eq('id', companyId)

        if (updateError) throw updateError

        return new Response(
            JSON.stringify({ success: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
