import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.11.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
})

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    const signature = req.headers.get('stripe-signature')
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

    if (!signature || !webhookSecret) {
        return new Response('Missing signature or webhook secret', { status: 400 })
    }

    try {
        const body = await req.text()
        const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)

        console.log(`WEBHOOK EVENT RECEIVED: ${event.type}`);

        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session
                const companyId = session.metadata?.company_id

                if (companyId && session.customer && session.subscription) {
                    const status = session.payment_status === 'paid' ? 'active' : 'trialing';
                    console.log(`CHECKOUT COMPLETED: Setting company ${companyId} status to ${status}`);

                    await supabase
                        .from('companies')
                        .update({
                            stripe_customer_id: session.customer as string,
                            subscription_id: session.subscription as string,
                            subscription_status: status,
                        })
                        .eq('id', companyId)
                }
                break
            }

            case 'customer.subscription.created':
            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription
                const customerId = subscription.customer as string

                console.log(`SUBSCRIPTION ${event.type}: Customer ${customerId}, Status ${subscription.status}`);

                // Find company by customer ID
                const { data: company } = await supabase
                    .from('companies')
                    .select('id')
                    .eq('stripe_customer_id', customerId)
                    .single()

                if (company) {
                    await supabase
                        .from('companies')
                        .update({
                            subscription_status: subscription.status,
                            subscription_id: subscription.id,
                            trial_end: subscription.trial_end
                                ? new Date(subscription.trial_end * 1000).toISOString()
                                : null,
                        })
                        .eq('id', company.id)
                }
                break
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription
                const customerId = subscription.customer as string

                const { data: company } = await supabase
                    .from('companies')
                    .select('id')
                    .eq('stripe_customer_id', customerId)
                    .single()

                if (company) {
                    await supabase
                        .from('companies')
                        .update({
                            subscription_status: 'canceled',
                        })
                        .eq('id', company.id)
                }
                break
            }

            case 'invoice.payment_succeeded': {
                const invoice = event.data.object as Stripe.Invoice
                console.log('PAYMENT SUCCEEDED: Invoice', invoice.id)
                break
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice
                const customerId = invoice.customer as string

                console.log('PAYMENT FAILED: Customer', customerId);

                const { data: company } = await supabase
                    .from('companies')
                    .select('id')
                    .eq('stripe_customer_id', customerId)
                    .single()

                if (company) {
                    await supabase
                        .from('companies')
                        .update({
                            subscription_status: 'past_due',
                        })
                        .eq('id', company.id)
                }
                break
            }

            default:
                console.log(`Unhandled event type: ${event.type}`)
        }

        return new Response(JSON.stringify({ received: true }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
        })
    } catch (error) {
        console.error('WEBHOOK ERROR:', error.message)
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        )
    }
})
