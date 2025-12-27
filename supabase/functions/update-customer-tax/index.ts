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
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const { companyId, taxId, address } = await req.json()

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Get company details
        const { data: company, error: fetchError } = await supabase
            .from('companies')
            .select('stripe_customer_id')
            .eq('id', companyId)
            .single()

        if (fetchError || !company?.stripe_customer_id) {
            throw new Error('Empresa no encontrada o sin ID de Stripe')
        }

        // 2. Update Stripe Customer Address
        await stripe.customers.update(company.stripe_customer_id, {
            address: address, // Expect { line1, city, state, postal_code, country }
        })

        // 3. Add/Update Tax ID (NIF/VAT)
        if (taxId) {
            // First list existing to avoid duplicates if possible, or just try catch
            try {
                const taxIds = await stripe.customers.listTaxIds(company.stripe_customer_id)
                // If it already exists, skip. Otherwise create.
                if (!taxIds.data.some(t => t.value.toUpperCase() === taxId.toUpperCase())) {
                    await stripe.customers.createTaxId(company.stripe_customer_id, {
                        type: 'eu_vat', // Suitable for Spain. For generic NIF, Stripe often handles via address/metadata
                        value: taxId,
                    })
                }
            } catch (e) {
                console.warn('Error adding tax ID:', e.message)
                // Note: 'eu_vat' might fail if the ID is strictly a local NIF not registered in VIES.
                // Fallback: Add to metadata for manual invoice handling if Stripe's stricter validation blocks it.
                await stripe.customers.update(company.stripe_customer_id, {
                    metadata: { tax_id_manual: taxId }
                })
            }
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
