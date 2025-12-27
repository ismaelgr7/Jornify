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
        const body = await req.json()
        const { companyId, taxId, address } = body

        if (!companyId) throw new Error('Falta el ID de la empresa')

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Get company details
        const { data: company, error: fetchError } = await supabase
            .from('companies')
            .select('id, name, email, stripe_customer_id')
            .eq('id', companyId)
            .single()

        if (fetchError || !company) {
            throw new Error(`Empresa no encontrada: ${fetchError?.message || 'Error desconocido'}`)
        }

        let customerId = company.stripe_customer_id

        // 1.1 If missing ID, try to find or create
        if (!customerId) {
            console.log(`Company ${companyId} missing Stripe ID. Searching by email: ${company.email}`)
            const existing = await stripe.customers.list({ email: company.email, limit: 1 })

            if (existing.data.length > 0) {
                customerId = existing.data[0].id
                console.log(`Found existing Stripe customer: ${customerId}`)
            } else {
                const newCustomer = await stripe.customers.create({
                    email: company.email,
                    name: company.name,
                    metadata: { company_id: companyId }
                })
                customerId = newCustomer.id
                console.log(`Created new Stripe customer: ${customerId}`)
            }

            // Update local DB
            await supabase
                .from('companies')
                .update({ stripe_customer_id: customerId })
                .eq('id', companyId)
        }

        // 2. Step-by-step updates for better error reporting
        const results: any = { address: 'pending', taxId: 'pending' }

        // 2.1 Update Address
        try {
            if (address) {
                await stripe.customers.update(customerId, {
                    address: {
                        line1: address.line1,
                        city: address.city,
                        postal_code: address.postal_code,
                        country: 'ES', // Explicitly ES for Spanish tax IDs to work
                    }
                })
                results.address = 'success'
            }
        } catch (addrErr) {
            results.address = `error: ${addrErr.message}`
        }

        // 2.2 Update Tax ID
        if (taxId) {
            let formattedTaxId = taxId.trim().toUpperCase();
            // Prefix with ES if missing and looks like a NIF/CIF
            if (!formattedTaxId.startsWith('ES')) {
                formattedTaxId = 'ES' + formattedTaxId;
            }

            try {
                const taxIds = await stripe.customers.listTaxIds(customerId)
                if (!taxIds.data.some(t => t.value.toUpperCase() === formattedTaxId)) {
                    await stripe.customers.createTaxId(customerId, {
                        type: 'eu_vat',
                        value: formattedTaxId,
                    })
                }
                results.taxId = 'success'
            } catch (taxErr) {
                results.taxId = `error: ${taxErr.message}`
                // Fallback to metadata so it's at least saved
                await stripe.customers.update(customerId, {
                    metadata: { tax_id_manual: taxId }
                })
            }
        }

        return new Response(JSON.stringify({ success: true, results }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        })

    } catch (err) {
        console.error('Function error:', err.message)
        return new Response(JSON.stringify({ error: err.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
