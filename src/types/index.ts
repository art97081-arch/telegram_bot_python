export interface User {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  is_bot: boolean;
  language_code?: string;
  registered_at: Date;
  last_activity: Date;
  role_id: string;
}

export interface UserRole {
  id: string;
  name: string;
  permissions: Permission[];
  created_at: Date;
}

export interface Permission {
  id: string;
  name: string;
  description: string;
}

export interface LogEntry {
  id: string;
  user_id: number;
  action: string;
  details: any;
  timestamp: Date;
  ip_address?: string;
}

export interface ActionRequest {
  id: string;
  user_id: number;
  action_type: ActionType;
  status: RequestStatus;
  data: any;
  created_at: Date;
  updated_at: Date;
  processed_by?: number;
  result?: any;
}

export enum ActionType {
  SAFECHECK = 'safecheck',
  TRON_CHECK = 'tron_check',
  RAPIRA_CHECK = 'rapira_check',
  USER_MANAGEMENT = 'user_management',
  ROLE_ASSIGNMENT = 'role_assignment',
  ADDRESS_CHECK = 'address_check',
  TRON_ANALYSIS = 'tron_analysis',
  SAFECHECK_RECEIPT = 'safecheck_receipt'
}

export enum RequestStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface SafeCheckResult {
  address: string;
  is_safe: boolean;
  risk_score: number;
  risk_factors: string[];
  last_checked: Date;
  source: string;
}

export interface TronAccountInfo {
  address: string;
  balance: number;
  trc20_balances: TokenBalance[];
  transactions_count: number;
  created_time: Date;
  last_operation_time?: Date;
  risk_assessment?: RiskAssessment;
}

export interface TokenBalance {
  token_address: string;
  token_name: string;
  token_symbol: string;
  balance: string;
  decimals: number;
}

export interface RiskAssessment {
  score: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  factors: string[];
  recommendations: string[];
}

export interface RapiraCheckResult {
  target: string;
  type: 'address' | 'domain' | 'hash';
  is_malicious: boolean;
  threat_level: number;
  categories: string[];
  description: string;
  last_seen?: Date;
  sources: string[];
}