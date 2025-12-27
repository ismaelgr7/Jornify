-- Add subscription columns to companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trialing'; -- trialing, active, past_due, canceled
ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_id TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS trial_end TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '14 days');
