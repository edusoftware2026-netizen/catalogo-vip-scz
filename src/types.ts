/**
 * Shared Type Definitions for Iam Dani Catálogo Santa Cruz
 */

export type ProfileStatus = 'borrador' | 'disponible' | 'ocupada' | 'pausada' | 'retirada';

export interface Profile {
  id: string;
  name: string;
  age: number; // Always >= 18
  description: string;
  rate_bs: number; // Referencial rate in Bs.
  commission_bs: number; // Reserve commission in Bs.
  photos: string[]; // URLs or paths to uploaded photos
  status: ProfileStatus;
  created_at: string;
  updated_at: string;
  telegram_message_id?: number | null;
  priority_order: number;
}

export type RequestStatus = 'pendiente' | 'confirmado' | 'rechazado' | 'completado' | 'comision_pagada';

export interface CustomerRequest {
  id: string;
  profile_id: string;
  profile_name: string;
  telegram_user_id?: string;
  telegram_username?: string;
  telegram_first_name?: string;
  status: RequestStatus;
  created_at: string;
  notes?: string;
  receipt_url?: string;
}

export interface ConversationState {
  telegram_user_id: string;
  step: string;
  draft_data: Partial<Profile>;
  active_profile_id?: string;
  last_updated: string;
}

export interface AuditLog {
  id: string;
  action: string;
  performed_by: string;
  profile_id?: string;
  details: string;
  timestamp: string;
}

export interface SyncErrorLog {
  id: string;
  profile_id: string;
  action: string;
  error_message: string;
  timestamp: string;
  status: 'pending' | 'resolved' | 'retried';
}

export interface AdminSession {
  token: string;
  telegram_user_id: string;
  expires_at: number;
}

export interface BotStatusInfo {
  configured: boolean;
  bot_username: string;
  channel_id: string;
  admin_count: number;
  webhook_url?: string;
}
