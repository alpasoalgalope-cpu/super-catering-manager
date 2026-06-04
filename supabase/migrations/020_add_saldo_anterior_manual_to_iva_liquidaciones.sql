-- Migration: Add saldo_anterior_manual to iva_liquidaciones
ALTER TABLE public.iva_liquidaciones 
ADD COLUMN IF NOT EXISTS saldo_anterior_manual numeric NOT NULL DEFAULT 0;
