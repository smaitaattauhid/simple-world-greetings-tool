
-- Phase 1: Database Security Hardening
-- Fix all database functions to use secure search_path settings

-- Update get_current_user_role function with secure search_path
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Update get_user_role function with secure search_path
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid DEFAULT NULL)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT role FROM public.user_roles 
  WHERE user_id = COALESCE(_user_id, auth.uid()) 
  LIMIT 1;
$$;

-- Update has_role function with secure search_path
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Update handle_new_user function with secure search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, address, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'phone', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'address', ''),
    'parent'
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    'parent'
  );
  
  RETURN NEW;
END;
$$;

-- Create a function to validate input data for additional security
CREATE OR REPLACE FUNCTION public.validate_user_input(input_text text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Basic validation: check for null, empty, or suspicious patterns
  IF input_text IS NULL OR LENGTH(TRIM(input_text)) = 0 THEN
    RETURN false;
  END IF;
  
  -- Check for potential SQL injection patterns
  IF input_text ~* '.*(drop|delete|truncate|alter|create|insert|update|grant|revoke).*' THEN
    RETURN false;
  END IF;
  
  -- Check for script injection patterns
  IF input_text ~* '.*(<script|javascript:|vbscript:|onload|onerror).*' THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- Add function to generate secure order numbers
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  order_prefix text := 'ORD';
  current_date_str text := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
  random_suffix text := LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
  order_number text;
BEGIN
  order_number := order_prefix || '-' || current_date_str || '-' || random_suffix;
  
  -- Ensure uniqueness
  WHILE EXISTS(SELECT 1 FROM public.orders WHERE order_number = order_number) LOOP
    random_suffix := LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
    order_number := order_prefix || '-' || current_date_str || '-' || random_suffix;
  END LOOP;
  
  RETURN order_number;
END;
$$;
