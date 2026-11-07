-- AL-DALALEK SAFE PREFLIGHT; READ-ONLY: SELECT ONLY.
-- Run in Supabase SQL Editor to identify real schema and current numbering.
-- Never paste secrets, password hashes, or user records into a support chat.

-- 1: Existing voucher-related tables, columns and types.
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN (
  'vouchers','transactions','voucher_sequences','item_units','voucher_unit_snapshots'
)
ORDER BY table_name, ordinal_position;

-- 2: Voucher functions, their signatures and whether they run as definer.
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_get_function_result(p.oid) AS returns,
       p.prosecdef AS security_definer
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname ILIKE '%voucher%'
ORDER BY p.proname, arguments;

-- 3: Aggregate counts. A voucher with many line items counts once.
SELECT transaction_type, EXTRACT(YEAR FROM date) AS voucher_year,
 COUNT(*) AS transaction_lines,
 COUNT(DISTINCT COALESCE(voucher_id::text,
    concat('legacy:',transaction_type,':',date::text,':',transaction_number))) AS distinct_vouchers,
 COUNT(*) FILTER (WHERE voucher_id IS NULL) AS legacy_lines
FROM public.transactions
GROUP BY transaction_type, EXTRACT(YEAR FROM date)
ORDER BY voucher_year DESC, transaction_type;

-- 4: Potential duplicate visible numbers in the same type/year.
SELECT transaction_type, EXTRACT(YEAR FROM date) AS voucher_year,
 transaction_number,
 COUNT(DISTINCT COALESCE(voucher_id::text,
    concat('legacy:',transaction_type,':',date::text,':',transaction_number))) AS different_vouchers
FROM public.transactions
GROUP BY transaction_type, EXTRACT(YEAR FROM date), transaction_number
HAVING COUNT(DISTINCT COALESCE(voucher_id::text,
    concat('legacy:',transaction_type,':',date::text,':',transaction_number))) > 1
ORDER BY voucher_year DESC, transaction_type, transaction_number;

-- These checks DO NOT modify stock, vouchers, sequences or historical records.
