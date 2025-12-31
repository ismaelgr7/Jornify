-- Create table for storing PWA push subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  subscription_json JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(employee_id) -- One subscription per employee for simplicity/overwrite
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE push_subscriptions;

-- Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Employees can manage their own subscriptions
CREATE POLICY "Employees can manage own subscriptions" 
ON push_subscriptions 
FOR ALL 
USING (auth.uid() = employee_id);
