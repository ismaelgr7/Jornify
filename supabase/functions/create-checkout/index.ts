import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
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
        const { companyId, companyEmail, employeeCount, returnUrl, stripeCustomerId } = await req.json()
        console.log('REQUEST RECEIVED:', { companyId, companyEmail, employeeCount, returnUrl, stripeCustomerId })

        if (!companyId || !companyEmail || !employeeCount) {
            throw new Error('Missing required fields')
        }

        const origin = returnUrl || req.headers.get('origin');

        const sessionOptions: any = {
            mode: 'subscription',
            payment_method_types: ['card'],
            billing_address_collection: 'required',
            line_items: [
                {
                    price: Deno.env.get('STRIPE_PRICE_ID'),
                    quantity: employeeCount,
                },
            ],
            subscription_data: {
                metadata: {
                    company_id: companyId,
                },
            },
            allow_promotion_codes: true,
            tax_id_collection: {
                enabled: true,
            },
            automatic_tax: {
                enabled: true,
            },
            success_url: `${origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/dashboard`,
            metadata: {
                company_id: companyId,
            },
        }

        if (stripeCustomerId) {
            sessionOptions.customer = stripeCustomerId;
        } else {
            sessionOptions.customer_email = companyEmail;
        }

        console.log('CREATING SESSION WITH OPTIONS:', JSON.stringify(sessionOptions))
        const session = await stripe.checkout.sessions.create(sessionOptions)
        console.log('SESSION CREATED:', session.id, session.url)

        return new Response(
            JSON.stringify({ url: session.url }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )
    } catch (error) {
        console.error('ERROR CREATING SESSION:', error.message)
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        )
    }
})
