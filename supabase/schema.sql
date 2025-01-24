
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";

CREATE EXTENSION IF NOT EXISTS "pgsodium" WITH SCHEMA "pgsodium";

COMMENT ON SCHEMA "public" IS 'standard public schema';

CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";

CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

CREATE TYPE "public"."message_type" AS ENUM (
    'user',
    'system'
);

ALTER TYPE "public"."message_type" OWNER TO "postgres";

CREATE TYPE "public"."ticket_priority" AS ENUM (
    'Low',
    'Medium',
    'High'
);

ALTER TYPE "public"."ticket_priority" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."assign_agent_to_team"("agent_id" "uuid", "team_id" bigint, "admin_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Verify admin permissions
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = admin_id 
    AND role = 'admin'
    AND company_id = (
      SELECT company_id FROM profiles WHERE id = agent_id
    )
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Update the agent's team
  UPDATE profiles 
  SET team_id = assign_agent_to_team.team_id  -- Fixed: Use the parameter instead of the column
  WHERE id = assign_agent_to_team.agent_id;    -- Fixed: Use the parameter
END;
$$;

ALTER FUNCTION "public"."assign_agent_to_team"("agent_id" "uuid", "team_id" bigint, "admin_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."assign_ticket_to_team"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- If focus_area_id is NULL, clear team assignment
  IF NEW.focus_area_id IS NULL THEN
    NEW.team_id = NULL;
  -- Otherwise try to assign to appropriate team
  ELSIF NEW.team_id IS NULL THEN
    SELECT team_id INTO NEW.team_id
    FROM team_focus_areas
    WHERE focus_area_id = NEW.focus_area_id
    AND team_id IN (
      SELECT t.id 
      FROM teams t
      JOIN profiles p ON p.company_id = t.company_id
      WHERE p.id = NEW.customer_id
    )
    LIMIT 1;
  END IF;
  
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."assign_ticket_to_team"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."close_resolved_ticket"("ticket_id_param" bigint, "agent_id_param" "uuid", "job_name" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$DECLARE
  last_message_time timestamptz;
  resolved_time timestamptz;
  ticket_exists boolean;
BEGIN
  RAISE LOG '=== STARTING CLOSE_RESOLVED_TICKET ===';
  RAISE LOG 'Parameters received - ticket_id: %, agent_id: %, job_name: %', ticket_id_param, agent_id_param, job_name;

  -- Check if ticket exists
  SELECT EXISTS (
    SELECT 1 FROM tickets WHERE id = ticket_id_param
  ) INTO ticket_exists;
  
  RAISE LOG 'Ticket exists: %', ticket_exists;

  IF NOT ticket_exists THEN
    RAISE WARNING 'ERROR: Ticket with ID % not found', ticket_id_param;
    RETURN;
  END IF;

  -- Get the resolved time and last message time, EXCLUDING system messages
  SELECT resolved_at, COALESCE(
    (SELECT created_at 
     FROM messages 
     WHERE ticket_id = ticket_id_param 
     AND type = 'user'  -- Only consider user messages, not system messages
     ORDER BY created_at DESC 
     LIMIT 1),
    resolved_at
  )
  INTO resolved_time, last_message_time
  FROM tickets
  WHERE id = ticket_id_param;

  RAISE LOG 'Times retrieved - resolved_time: %, last_message_time: % (excluding system messages)', resolved_time, last_message_time;

  -- If no new user messages since being resolved, close the ticket
  IF last_message_time <= resolved_time THEN
    RAISE LOG 'No new user messages found since resolution, proceeding to close ticket';
    
    BEGIN
      -- Update ticket status
      UPDATE tickets 
      SET status = 'closed',
          closed_at = NOW()
      WHERE id = ticket_id_param;
      
      RAISE LOG 'Ticket status updated to closed';

      -- Add system message
      INSERT INTO messages (
        ticket_id,
        content,
        sender_id,
        type
      ) VALUES (
        ticket_id_param,
        'Ticket automatically closed due to no response.',
        agent_id_param,
        'system'
      );

      RAISE LOG 'System message inserted successfully';
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Error occurred during update/insert: %, %', SQLERRM, SQLSTATE;
        RAISE;
    END;
  ELSE
    RAISE LOG 'New user messages found since resolution, ticket will not be closed';
    RAISE LOG 'Last user message time (%) is after resolved time (%)', last_message_time, resolved_time;
  END IF;

  BEGIN
    -- Unschedule the job after execution
    PERFORM cron.unschedule(job_name);
    RAISE LOG 'Successfully unscheduled job: %', job_name;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Error unscheduling job: %, %', SQLERRM, SQLSTATE;
      RAISE;
  END;

  RAISE LOG '=== FINISHED CLOSE_RESOLVED_TICKET ===';
END;$$;

ALTER FUNCTION "public"."close_resolved_ticket"("ticket_id_param" bigint, "agent_id_param" "uuid", "job_name" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_companies"() RETURNS TABLE("id" "uuid", "name" "text")
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
    SELECT id, name FROM companies;
$$;

ALTER FUNCTION "public"."get_companies"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "full_name" "text",
    "last_seen" timestamp without time zone,
    "avatar_url" "text",
    "team_id" bigint,
    "company_id" "uuid",
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['customer'::"text", 'human_agent'::"text", 'admin'::"text"])))
);

ALTER TABLE "public"."profiles" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_company_profiles"("company_id_input" "uuid") RETURNS SETOF "public"."profiles"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT * FROM profiles 
  WHERE company_id = company_id_input;
$$;

ALTER FUNCTION "public"."get_company_profiles"("company_id_input" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_profile"("user_id" "uuid") RETURNS TABLE("id" "uuid", "role" "text", "company_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    profiles.id,
    profiles.role,
    profiles.company_id
  FROM profiles
  WHERE profiles.id = user_id;
END;
$$;

ALTER FUNCTION "public"."get_profile"("user_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_user_company_id"() RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  my_company_id uuid;
BEGIN
  -- Temporarily disable RLS so we can read from profiles directly.
  SET LOCAL row_security = off;

  SELECT company_id
    INTO my_company_id
    FROM public.profiles
   WHERE id = auth.uid();

  RETURN my_company_id;
END;
$$;

ALTER FUNCTION "public"."get_user_company_id"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_user_role"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  my_role text;
BEGIN
  SET LOCAL row_security = off;

  SELECT role
    INTO my_role
    FROM public.profiles
   WHERE id = auth.uid();

  RETURN my_role;
END;
$$;

ALTER FUNCTION "public"."get_user_role"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_company_id UUID;
  v_next_order INTEGER;
BEGIN
  -- If the user signed up to create a new company (i.e., "Register Company"):
  IF (NEW.raw_user_meta_data->>'company_name') IS NOT NULL THEN
    -- 1. Create the new company
    INSERT INTO public.companies (name)
    VALUES (NEW.raw_user_meta_data->>'company_name')
    RETURNING id INTO v_company_id;

    -- 2. Create the new admin profile linked to that company
    INSERT INTO public.profiles (id, role, full_name, company_id)
    VALUES (
      NEW.id,
      'admin',
      NEW.raw_user_meta_data->>'full_name',
      v_company_id
    );

    -- 3. Create default field definitions
    INSERT INTO public.field_definitions 
      (company_id, name, label, field_type, is_required, display_order)
    VALUES
      (v_company_id, 'subject', 'Subject', 'text', true, 1),
      (v_company_id, 'content', 'Content', 'text', true, 2);

  -- If role is specified in metadata, use that role (for human agents)
  ELSIF (NEW.raw_user_meta_data->>'role') IS NOT NULL THEN
    INSERT INTO public.profiles (id, role, full_name, company_id)
    VALUES (
      NEW.id,
      NEW.raw_user_meta_data->>'role',
      NEW.raw_user_meta_data->>'full_name',
      (NEW.raw_user_meta_data->>'company_id')::uuid
    );

  -- Existing customer signup flow
  ELSIF (NEW.raw_user_meta_data->>'company_id') IS NOT NULL THEN
    v_company_id := (NEW.raw_user_meta_data->>'company_id')::uuid;

    INSERT INTO public.profiles (id, role, full_name, company_id)
    VALUES (
      NEW.id,
      'customer',
      NEW.raw_user_meta_data->>'full_name',
      v_company_id
    );

  ELSE
    -- Fallback: no company info provided
    INSERT INTO public.profiles (id, role, full_name)
    VALUES (
      NEW.id,
      'customer',
      NEW.raw_user_meta_data->>'full_name'
    );
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."schedule_auto_close"("job_name" "text", "ticket_id" bigint, "agent_id" "uuid", "minutes_until_close" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  cron_schedule text;
  sql_command text;
  target_time timestamptz;
BEGIN
  RAISE LOG '=== STARTING SCHEDULE_AUTO_CLOSE ===';
  RAISE LOG 'Parameters received - job_name: %, ticket_id: %, agent_id: %, minutes_until_close: %', 
               job_name, ticket_id, agent_id, minutes_until_close;

  -- Calculate the target time
  target_time := now() + (minutes_until_close || ' minutes')::interval;
  
  -- Extract minute and hour for the cron schedule
  cron_schedule := format(
    '%s %s %s %s *',
    date_part('minute', target_time)::integer,
    date_part('hour', target_time)::integer,
    date_part('day', target_time)::integer,
    date_part('month', target_time)::integer
  );
  
  RAISE LOG 'Current time: %', now();
  RAISE LOG 'Target time: %', target_time;
  RAISE LOG 'Calculated cron schedule: %', cron_schedule;

  -- Prepare SQL command
  sql_command := format(
    'SELECT close_resolved_ticket(%s, %L::uuid, %L);',
    ticket_id, 
    agent_id, 
    job_name
  );
  
  RAISE LOG 'Prepared SQL command: %', sql_command;

  BEGIN
    -- Schedule the job
    PERFORM cron.schedule(
      job_name,
      cron_schedule,
      sql_command
    );
    RAISE LOG 'Successfully scheduled cron job';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Error scheduling cron job: %, %', SQLERRM, SQLSTATE;
      RAISE;
  END;

  RAISE LOG '=== FINISHED SCHEDULE_AUTO_CLOSE ===';
END;
$$;

ALTER FUNCTION "public"."schedule_auto_close"("job_name" "text", "ticket_id" bigint, "agent_id" "uuid", "minutes_until_close" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."unschedule_job"("job_name" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM cron.unschedule(job_name);
END;
$$;

ALTER FUNCTION "public"."unschedule_job"("job_name" "text") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL
);

ALTER TABLE "public"."companies" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."field_definitions" (
    "id" bigint NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "label" "text" NOT NULL,
    "field_type" "text" NOT NULL,
    "is_required" boolean DEFAULT false NOT NULL,
    "options" "jsonb"[] DEFAULT '{}'::"jsonb"[],
    "allows_multiple" boolean DEFAULT false NOT NULL,
    "display_order" integer NOT NULL
);

ALTER TABLE "public"."field_definitions" OWNER TO "postgres";

CREATE SEQUENCE IF NOT EXISTS "public"."field_definitions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER TABLE "public"."field_definitions_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."field_definitions_id_seq" OWNED BY "public"."field_definitions"."id";

CREATE TABLE IF NOT EXISTS "public"."focus_areas" (
    "id" bigint NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL
);

ALTER TABLE "public"."focus_areas" OWNER TO "postgres";

CREATE SEQUENCE IF NOT EXISTS "public"."focus_areas_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER TABLE "public"."focus_areas_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."focus_areas_id_seq" OWNED BY "public"."focus_areas"."id";

CREATE TABLE IF NOT EXISTS "public"."internal_notes" (
    "id" bigint NOT NULL,
    "ticket_id" bigint NOT NULL,
    "human_agent_id" "uuid" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "content" "text" NOT NULL
);

ALTER TABLE "public"."internal_notes" OWNER TO "postgres";

CREATE SEQUENCE IF NOT EXISTS "public"."internal_notes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER TABLE "public"."internal_notes_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."internal_notes_id_seq" OWNED BY "public"."internal_notes"."id";

CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" bigint NOT NULL,
    "ticket_id" bigint NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "type" "public"."message_type" DEFAULT 'user'::"public"."message_type" NOT NULL
);

ALTER TABLE "public"."messages" OWNER TO "postgres";

CREATE SEQUENCE IF NOT EXISTS "public"."messages_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER TABLE "public"."messages_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."messages_id_seq" OWNED BY "public"."messages"."id";

CREATE TABLE IF NOT EXISTS "public"."team_focus_areas" (
    "team_id" bigint NOT NULL,
    "focus_area_id" bigint NOT NULL
);

ALTER TABLE "public"."team_focus_areas" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" bigint NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL
);

ALTER TABLE "public"."teams" OWNER TO "postgres";

CREATE SEQUENCE IF NOT EXISTS "public"."teams_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER TABLE "public"."teams_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."teams_id_seq" OWNED BY "public"."teams"."id";

CREATE TABLE IF NOT EXISTS "public"."ticket_fields" (
    "ticket_id" bigint NOT NULL,
    "field_definition_id" bigint NOT NULL,
    "value" "text"
);

ALTER TABLE "public"."ticket_fields" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."tickets" (
    "id" bigint NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "human_agent_id" "uuid",
    "team_id" bigint,
    "focus_area_id" bigint,
    "resolved_at" timestamp without time zone,
    "closed_at" timestamp without time zone,
    "priority" "public"."ticket_priority" DEFAULT 'Medium'::"public"."ticket_priority" NOT NULL
);

ALTER TABLE "public"."tickets" OWNER TO "postgres";

CREATE SEQUENCE IF NOT EXISTS "public"."tickets_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER TABLE "public"."tickets_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."tickets_id_seq" OWNED BY "public"."tickets"."id";

ALTER TABLE ONLY "public"."field_definitions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."field_definitions_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."focus_areas" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."focus_areas_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."internal_notes" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."internal_notes_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."messages" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."messages_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."teams" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."teams_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."tickets" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tickets_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."field_definitions"
    ADD CONSTRAINT "field_definitions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."focus_areas"
    ADD CONSTRAINT "focus_areas_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."internal_notes"
    ADD CONSTRAINT "internal_notes_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."team_focus_areas"
    ADD CONSTRAINT "team_focus_areas_pkey" PRIMARY KEY ("team_id", "focus_area_id");

ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."ticket_fields"
    ADD CONSTRAINT "ticket_fields_pkey" PRIMARY KEY ("ticket_id", "field_definition_id");

ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_pkey" PRIMARY KEY ("id");

CREATE INDEX "idx_field_definitions_company_order" ON "public"."field_definitions" USING "btree" ("company_id", "display_order");

CREATE OR REPLACE TRIGGER "before_ticket_change" BEFORE INSERT OR UPDATE OF "focus_area_id" ON "public"."tickets" FOR EACH ROW EXECUTE FUNCTION "public"."assign_ticket_to_team"();

ALTER TABLE ONLY "public"."field_definitions"
    ADD CONSTRAINT "field_definitions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");

ALTER TABLE ONLY "public"."focus_areas"
    ADD CONSTRAINT "focus_areas_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");

ALTER TABLE ONLY "public"."internal_notes"
    ADD CONSTRAINT "internal_notes_human_agent_id_fkey" FOREIGN KEY ("human_agent_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."internal_notes"
    ADD CONSTRAINT "internal_notes_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY "public"."team_focus_areas"
    ADD CONSTRAINT "team_focus_areas_focus_area_id_fkey" FOREIGN KEY ("focus_area_id") REFERENCES "public"."focus_areas"("id");

ALTER TABLE ONLY "public"."team_focus_areas"
    ADD CONSTRAINT "team_focus_areas_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");

ALTER TABLE ONLY "public"."ticket_fields"
    ADD CONSTRAINT "ticket_fields_field_definition_id_fkey" FOREIGN KEY ("field_definition_id") REFERENCES "public"."field_definitions"("id");

ALTER TABLE ONLY "public"."ticket_fields"
    ADD CONSTRAINT "ticket_fields_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id");

ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_focus_area_id_fkey" FOREIGN KEY ("focus_area_id") REFERENCES "public"."focus_areas"("id");

ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_human_agent_id_fkey" FOREIGN KEY ("human_agent_id") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE SET NULL;

CREATE POLICY "admins_can_create_focus_areas" ON "public"."focus_areas" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text") AND ("profiles"."company_id" = "focus_areas"."company_id")))));

CREATE POLICY "admins_can_create_teams" ON "public"."teams" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text") AND ("profiles"."company_id" = "teams"."company_id")))));

CREATE POLICY "admins_can_delete_focus_areas" ON "public"."focus_areas" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text") AND ("profiles"."company_id" = "focus_areas"."company_id")))));

CREATE POLICY "admins_can_delete_teams" ON "public"."teams" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text") AND ("profiles"."company_id" = "teams"."company_id")))));

CREATE POLICY "admins_can_manage_agent_teams" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "profiles_1"
  WHERE (("profiles_1"."id" = "auth"."uid"()) AND ("profiles_1"."role" = 'admin'::"text") AND ("profiles_1"."company_id" = "profiles_1"."company_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "profiles_1"
  WHERE (("profiles_1"."id" = "auth"."uid"()) AND ("profiles_1"."role" = 'admin'::"text") AND ("profiles_1"."company_id" = "profiles_1"."company_id")))));

CREATE POLICY "admins_can_manage_field_definitions" ON "public"."field_definitions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text") AND ("profiles"."company_id" = "field_definitions"."company_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text") AND ("profiles"."company_id" = "field_definitions"."company_id")))));

CREATE POLICY "admins_can_manage_team_focus_areas" ON "public"."team_focus_areas" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text") AND ("profiles"."company_id" = ( SELECT "teams"."company_id"
           FROM "public"."teams"
          WHERE ("teams"."id" = "team_focus_areas"."team_id")))))));

CREATE POLICY "admins_can_update_agent_teams" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() IN ( SELECT "profiles_1"."id"
   FROM "public"."profiles" "profiles_1"
  WHERE (("profiles_1"."role" = 'admin'::"text") AND ("profiles_1"."company_id" = ( SELECT "profiles_2"."company_id"
           FROM "public"."profiles" "profiles_2"
          WHERE ("profiles_2"."id" = "auth"."uid"()))))))) WITH CHECK (("auth"."uid"() IN ( SELECT "profiles_1"."id"
   FROM "public"."profiles" "profiles_1"
  WHERE (("profiles_1"."role" = 'admin'::"text") AND ("profiles_1"."company_id" = ( SELECT "profiles_2"."company_id"
           FROM "public"."profiles" "profiles_2"
          WHERE ("profiles_2"."id" = "auth"."uid"())))))));

CREATE POLICY "admins_can_update_focus_areas" ON "public"."focus_areas" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text") AND ("profiles"."company_id" = "focus_areas"."company_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text") AND ("profiles"."company_id" = "focus_areas"."company_id")))));

CREATE POLICY "admins_can_view_company_profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("public"."get_user_role"() = 'admin'::"text") AND ("public"."get_user_company_id"() = "company_id")));

CREATE POLICY "agents_and_admins_can_delete_own_notes" ON "public"."internal_notes" FOR DELETE TO "authenticated" USING ((("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'human_agent'::"text"])) AND (("human_agent_id" = "auth"."uid"()) OR ("public"."get_user_role"() = 'admin'::"text")) AND (EXISTS ( SELECT 1
   FROM ("public"."tickets"
     JOIN "public"."profiles" ON (("tickets"."customer_id" = "profiles"."id")))
  WHERE (("tickets"."id" = "internal_notes"."ticket_id") AND ("profiles"."company_id" = "public"."get_user_company_id"()))))));

CREATE POLICY "agents_and_admins_can_insert_internal_notes" ON "public"."internal_notes" FOR INSERT TO "authenticated" WITH CHECK ((("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'human_agent'::"text"])) AND ("human_agent_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM ("public"."tickets"
     JOIN "public"."profiles" ON (("tickets"."customer_id" = "profiles"."id")))
  WHERE (("tickets"."id" = "internal_notes"."ticket_id") AND ("profiles"."company_id" = "public"."get_user_company_id"()))))));

CREATE POLICY "agents_and_admins_can_select_internal_notes" ON "public"."internal_notes" FOR SELECT TO "authenticated" USING ((("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'human_agent'::"text"])) AND (EXISTS ( SELECT 1
   FROM ("public"."tickets"
     JOIN "public"."profiles" ON (("tickets"."customer_id" = "profiles"."id")))
  WHERE (("tickets"."id" = "internal_notes"."ticket_id") AND ("profiles"."company_id" = "public"."get_user_company_id"()))))));

CREATE POLICY "agents_and_admins_can_update_own_notes" ON "public"."internal_notes" FOR UPDATE TO "authenticated" USING ((("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'human_agent'::"text"])) AND (EXISTS ( SELECT 1
   FROM ("public"."tickets"
     JOIN "public"."profiles" ON (("tickets"."customer_id" = "profiles"."id")))
  WHERE (("tickets"."id" = "internal_notes"."ticket_id") AND ("profiles"."company_id" = "public"."get_user_company_id"())))))) WITH CHECK ((("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'human_agent'::"text"])) AND (("human_agent_id" = "auth"."uid"()) OR ("public"."get_user_role"() = 'admin'::"text")) AND (EXISTS ( SELECT 1
   FROM ("public"."tickets"
     JOIN "public"."profiles" ON (("tickets"."customer_id" = "profiles"."id")))
  WHERE (("tickets"."id" = "internal_notes"."ticket_id") AND ("profiles"."company_id" = "public"."get_user_company_id"()))))));

CREATE POLICY "allow_insert_companies" ON "public"."companies" FOR INSERT TO "authenticated" WITH CHECK (true);

CREATE POLICY "allow_select_companies" ON "public"."companies" FOR SELECT TO "authenticated" USING (true);

ALTER TABLE "public"."companies" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_can_view_company_agents" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("public"."get_user_role"() = 'customer'::"text") AND ("public"."get_user_company_id"() = "company_id") AND ("role" = 'human_agent'::"text")));

CREATE POLICY "customers_can_view_own_tickets" ON "public"."tickets" FOR SELECT TO "authenticated" USING ((("customer_id" = "auth"."uid"()) OR ("human_agent_id" = "auth"."uid"()) OR ("team_id" IN ( SELECT "profiles"."team_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))));

ALTER TABLE "public"."field_definitions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."focus_areas" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "human_agents_can_update_tickets" ON "public"."tickets" FOR UPDATE TO "authenticated" USING (("auth"."uid"() IN ( SELECT "p"."id"
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'human_agent'::"text"))))) WITH CHECK (("auth"."uid"() IN ( SELECT "p"."id"
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'human_agent'::"text")))));

CREATE POLICY "human_agents_can_view_customer_profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("role" = 'customer'::"text") AND ("public"."get_user_role"() = 'human_agent'::"text") AND ("public"."get_user_company_id"() = "company_id")));

ALTER TABLE "public"."internal_notes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."team_focus_areas" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ticket_fields" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."tickets" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_create_tickets" ON "public"."tickets" FOR INSERT TO "authenticated" WITH CHECK ((("customer_id" = "auth"."uid"()) AND (("focus_area_id" IS NULL) OR ("focus_area_id" IN ( SELECT "focus_areas"."id"
   FROM "public"."focus_areas"
  WHERE ("focus_areas"."company_id" = ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))))));

CREATE POLICY "users_can_insert_messages" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."tickets"
  WHERE (("tickets"."id" = "messages"."ticket_id") AND (("tickets"."customer_id" = "auth"."uid"()) OR ("tickets"."human_agent_id" = "auth"."uid"()) OR ("tickets"."team_id" IN ( SELECT "profiles"."team_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))))));

CREATE POLICY "users_can_manage_ticket_fields" ON "public"."ticket_fields" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."tickets"
     JOIN "public"."profiles" ON (("profiles"."id" = "auth"."uid"())))
  WHERE (("tickets"."id" = "ticket_fields"."ticket_id") AND ((("profiles"."role" = 'admin'::"text") AND ("profiles"."company_id" = ( SELECT "p2"."company_id"
           FROM "public"."profiles" "p2"
          WHERE ("p2"."id" = "tickets"."customer_id")))) OR ("profiles"."id" = "tickets"."customer_id") OR ("profiles"."id" = "tickets"."human_agent_id") OR ("profiles"."team_id" = "tickets"."team_id")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."tickets"
     JOIN "public"."profiles" ON (("profiles"."id" = "auth"."uid"())))
  WHERE (("tickets"."id" = "ticket_fields"."ticket_id") AND ((("profiles"."role" = 'admin'::"text") AND ("profiles"."company_id" = ( SELECT "p2"."company_id"
           FROM "public"."profiles" "p2"
          WHERE ("p2"."id" = "tickets"."customer_id")))) OR ("profiles"."id" = "tickets"."customer_id") OR ("profiles"."id" = "tickets"."human_agent_id") OR ("profiles"."team_id" = "tickets"."team_id"))))));

CREATE POLICY "users_can_view_company_field_definitions" ON "public"."field_definitions" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));

CREATE POLICY "users_can_view_company_focus_areas" ON "public"."focus_areas" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));

CREATE POLICY "users_can_view_company_team_focus_areas" ON "public"."team_focus_areas" FOR SELECT TO "authenticated" USING (("team_id" IN ( SELECT "teams"."id"
   FROM "public"."teams"
  WHERE ("teams"."company_id" IN ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));

CREATE POLICY "users_can_view_company_teams" ON "public"."teams" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));

CREATE POLICY "users_can_view_own_company" ON "public"."companies" FOR SELECT TO "authenticated" USING (("id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));

CREATE POLICY "users_can_view_own_profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));

CREATE POLICY "users_can_view_relevant_messages" ON "public"."messages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."tickets"
  WHERE (("tickets"."id" = "messages"."ticket_id") AND (("tickets"."customer_id" = "auth"."uid"()) OR ("tickets"."human_agent_id" = "auth"."uid"()) OR ("tickets"."team_id" IN ( SELECT "profiles"."team_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))))));

CREATE POLICY "users_can_view_relevant_tickets" ON "public"."tickets" FOR SELECT TO "authenticated" USING ((("customer_id" = "auth"."uid"()) OR ("human_agent_id" = "auth"."uid"()) OR (("focus_area_id" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'human_agent'::"text") AND ("profiles"."company_id" = ( SELECT "profiles_1"."company_id"
           FROM "public"."profiles" "profiles_1"
          WHERE ("profiles_1"."id" = "tickets"."customer_id"))))))) OR ("team_id" IN ( SELECT "profiles"."team_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) OR ("customer_id" IN ( SELECT "p"."id"
   FROM "public"."profiles" "p"
  WHERE ("p"."company_id" = ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"())))))));

CREATE POLICY "users_can_view_team_focus_areas" ON "public"."team_focus_areas" FOR SELECT TO "authenticated" USING (("team_id" IN ( SELECT "teams"."id"
   FROM "public"."teams"
  WHERE ("teams"."company_id" = ( SELECT "profiles"."company_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));

CREATE PUBLICATION "realtime_messages_publication_v2_34_1" WITH (publish = 'insert, update, delete, truncate');

ALTER PUBLICATION "realtime_messages_publication_v2_34_1" OWNER TO "supabase_admin";

ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";

CREATE PUBLICATION "supabase_realtime_messages_publication_v2_34_6" WITH (publish = 'insert, update, delete, truncate');

ALTER PUBLICATION "supabase_realtime_messages_publication_v2_34_6" OWNER TO "supabase_admin";

ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."focus_areas";

ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."internal_notes";

ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."messages";

ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."profiles";

ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."tickets";

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

GRANT ALL ON FUNCTION "public"."assign_agent_to_team"("agent_id" "uuid", "team_id" bigint, "admin_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."assign_agent_to_team"("agent_id" "uuid", "team_id" bigint, "admin_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_agent_to_team"("agent_id" "uuid", "team_id" bigint, "admin_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."assign_ticket_to_team"() TO "anon";
GRANT ALL ON FUNCTION "public"."assign_ticket_to_team"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_ticket_to_team"() TO "service_role";

GRANT ALL ON FUNCTION "public"."close_resolved_ticket"("ticket_id_param" bigint, "agent_id_param" "uuid", "job_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."close_resolved_ticket"("ticket_id_param" bigint, "agent_id_param" "uuid", "job_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."close_resolved_ticket"("ticket_id_param" bigint, "agent_id_param" "uuid", "job_name" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."get_companies"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_companies"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_companies"() TO "service_role";

GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";

GRANT SELECT("full_name") ON TABLE "public"."profiles" TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_company_profiles"("company_id_input" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_company_profiles"("company_id_input" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_company_profiles"("company_id_input" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."get_profile"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_profile"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_profile"("user_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."get_user_company_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_company_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_company_id"() TO "service_role";

GRANT ALL ON FUNCTION "public"."get_user_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"() TO "service_role";

GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";

GRANT ALL ON FUNCTION "public"."schedule_auto_close"("job_name" "text", "ticket_id" bigint, "agent_id" "uuid", "minutes_until_close" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."schedule_auto_close"("job_name" "text", "ticket_id" bigint, "agent_id" "uuid", "minutes_until_close" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."schedule_auto_close"("job_name" "text", "ticket_id" bigint, "agent_id" "uuid", "minutes_until_close" integer) TO "service_role";

GRANT ALL ON FUNCTION "public"."unschedule_job"("job_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."unschedule_job"("job_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unschedule_job"("job_name" "text") TO "service_role";

GRANT ALL ON TABLE "public"."companies" TO "anon";
GRANT ALL ON TABLE "public"."companies" TO "authenticated";
GRANT ALL ON TABLE "public"."companies" TO "service_role";

GRANT ALL ON TABLE "public"."field_definitions" TO "anon";
GRANT ALL ON TABLE "public"."field_definitions" TO "authenticated";
GRANT ALL ON TABLE "public"."field_definitions" TO "service_role";

GRANT ALL ON SEQUENCE "public"."field_definitions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."field_definitions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."field_definitions_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."focus_areas" TO "anon";
GRANT ALL ON TABLE "public"."focus_areas" TO "authenticated";
GRANT ALL ON TABLE "public"."focus_areas" TO "service_role";

GRANT ALL ON SEQUENCE "public"."focus_areas_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."focus_areas_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."focus_areas_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."internal_notes" TO "anon";
GRANT ALL ON TABLE "public"."internal_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."internal_notes" TO "service_role";

GRANT ALL ON SEQUENCE "public"."internal_notes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."internal_notes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."internal_notes_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";

GRANT ALL ON SEQUENCE "public"."messages_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."messages_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."messages_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."team_focus_areas" TO "anon";
GRANT ALL ON TABLE "public"."team_focus_areas" TO "authenticated";
GRANT ALL ON TABLE "public"."team_focus_areas" TO "service_role";

GRANT ALL ON TABLE "public"."teams" TO "anon";
GRANT ALL ON TABLE "public"."teams" TO "authenticated";
GRANT ALL ON TABLE "public"."teams" TO "service_role";

GRANT ALL ON SEQUENCE "public"."teams_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."teams_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."teams_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."ticket_fields" TO "anon";
GRANT ALL ON TABLE "public"."ticket_fields" TO "authenticated";
GRANT ALL ON TABLE "public"."ticket_fields" TO "service_role";

GRANT ALL ON TABLE "public"."tickets" TO "anon";
GRANT ALL ON TABLE "public"."tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."tickets" TO "service_role";

GRANT ALL ON SEQUENCE "public"."tickets_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tickets_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tickets_id_seq" TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";

RESET ALL;
