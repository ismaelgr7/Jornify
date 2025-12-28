export interface Company {
  id: string;
  name: string;
  email: string;
  password?: string;
  pin: string;
  owner_id: string;
  stripe_customer_id?: string;
  subscription_status?: 'trialing' | 'active' | 'past_due' | 'canceled';
  subscription_id?: string;
  trial_end?: string;
  created_at?: string;
  tax_id?: string;
  address_line1?: string;
  address_city?: string;
  address_state?: string;
  address_postal_code?: string;
  fiscal_name?: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  password?: string;
  company_pin: string;
  company_id: string;
  contracted_hours_per_week: number; // Configurado por la empresa
  user_id: string;
  clock_out_nudge?: boolean;
  nudge_time?: string;
}

export interface TimeRecord {
  id: string;
  employee_id: string;
  employee_name?: string;
  start_time: string; // ISO String
  end_time: string | null; // ISO String or null
  duration_minutes: number;
  type?: 'work' | 'break';
  row_hash?: string;
  parent_hash?: string;
  notes?: string;
}

export type UserRole = 'employee' | 'company' | null;

export interface AuthState {
  user: Employee | Company | null;
  role: UserRole;
  rememberMe: boolean;
}