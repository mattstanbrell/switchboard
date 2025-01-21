
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

CREATE EXTENSION IF NOT EXISTS "pgsodium" WITH SCHEMA "pgsodium";

COMMENT ON SCHEMA "public" IS 'standard public schema';

CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";

CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

CREATE OR REPLACE FUNCTION "public"."get_companies"() RETURNS TABLE("id" integer, "name" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT id, name 
  FROM companies 
  ORDER BY name;
$$;

ALTER FUNCTION "public"."get_companies"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_user_role"("user_id" "uuid") RETURNS "text"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT role FROM profiles WHERE id = user_id
$$;

ALTER FUNCTION "public"."get_user_role"("user_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  new_company_id INTEGER;
BEGIN
  -- Create company first if admin
  IF NEW.raw_user_meta_data->>'role' = 'admin' THEN
    INSERT INTO companies (name)
    VALUES (NEW.raw_user_meta_data->>'company_name')
    RETURNING id INTO new_company_id;
  ELSE
    -- For customers, use the selected company_id from metadata
    new_company_id := (NEW.raw_user_meta_data->>'company_id')::integer;
    
    -- Validate that the company exists
    IF NOT EXISTS (SELECT 1 FROM companies WHERE id = new_company_id) THEN
      RAISE EXCEPTION 'Invalid company_id: %', new_company_id;
    END IF;
  END IF;

  -- Insert profile with company reference
  INSERT INTO profiles (id, full_name, role, company_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer'),
    new_company_id
  );

  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";

CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" integer NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);

ALTER TABLE "public"."companies" OWNER TO "postgres";

CREATE SEQUENCE IF NOT EXISTS "public"."companies_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER TABLE "public"."companies_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."companies_id_seq" OWNED BY "public"."companies"."id";

CREATE TABLE IF NOT EXISTS "public"."focus_areas" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "company_id" integer
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

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "team_id" bigint,
    "company_id" integer,
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['customer'::"text", 'human_agent'::"text", 'admin'::"text"])))
);

ALTER TABLE "public"."profiles" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."team_focus_areas" (
    "team_id" bigint NOT NULL,
    "focus_area_id" bigint NOT NULL
);

ALTER TABLE "public"."team_focus_areas" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "company_id" "uuid"
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

CREATE TABLE IF NOT EXISTS "public"."tickets" (
    "id" bigint NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "subject" "text" NOT NULL,
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "focus_area_id" bigint NOT NULL
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

ALTER TABLE ONLY "public"."companies" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."companies_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."focus_areas" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."focus_areas_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."teams" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."teams_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."tickets" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tickets_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."focus_areas"
    ADD CONSTRAINT "focus_areas_name_key" UNIQUE ("name");

ALTER TABLE ONLY "public"."focus_areas"
    ADD CONSTRAINT "focus_areas_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."team_focus_areas"
    ADD CONSTRAINT "team_focus_areas_pkey" PRIMARY KEY ("team_id", "focus_area_id");

ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_pkey" PRIMARY KEY ("id");

CREATE INDEX "idx_profiles_team_id" ON "public"."profiles" USING "btree" ("team_id");

CREATE INDEX "idx_teams_company_id" ON "public"."teams" USING "btree" ("company_id");

CREATE INDEX "idx_tickets_created_at" ON "public"."tickets" USING "btree" ("created_at");

CREATE INDEX "idx_tickets_customer_id" ON "public"."tickets" USING "btree" ("customer_id");

CREATE INDEX "idx_tickets_focus_area_id" ON "public"."tickets" USING "btree" ("focus_area_id");

CREATE INDEX "idx_tickets_status" ON "public"."tickets" USING "btree" ("status");

ALTER TABLE ONLY "public"."focus_areas"
    ADD CONSTRAINT "focus_areas_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id");

ALTER TABLE ONLY "public"."team_focus_areas"
    ADD CONSTRAINT "team_focus_areas_focus_area_id_fkey" FOREIGN KEY ("focus_area_id") REFERENCES "public"."focus_areas"("id");

ALTER TABLE ONLY "public"."team_focus_areas"
    ADD CONSTRAINT "team_focus_areas_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id");

ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "auth"."users"("id");

ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_focus_area_id_fkey" FOREIGN KEY ("focus_area_id") REFERENCES "public"."focus_areas"("id");

CREATE POLICY "Admins can create focus areas" ON "public"."focus_areas" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text") AND ("profiles"."company_id" = "profiles"."company_id")))));

CREATE POLICY "Admins can manage company focus areas" ON "public"."focus_areas" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."profiles" "ap"
     JOIN "public"."teams" "t" ON (("ap"."team_id" = "t"."id")))
     JOIN "public"."team_focus_areas" "tfa" ON (("tfa"."team_id" = "t"."id")))
  WHERE (("ap"."id" = "auth"."uid"()) AND ("ap"."role" = 'admin'::"text") AND ("tfa"."focus_area_id" = "focus_areas"."id") AND ("t"."company_id" = ( SELECT "t2"."company_id"
           FROM "public"."teams" "t2"
          WHERE ("t2"."id" = "tfa"."team_id")))))));

CREATE POLICY "Admins can manage company teams" ON "public"."teams" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "ap"
  WHERE (("ap"."id" = "auth"."uid"()) AND ("ap"."role" = 'admin'::"text") AND ("ap"."company_id" = ( SELECT "p2"."company_id"
           FROM "public"."profiles" "p2"
          WHERE ("p2"."team_id" = "teams"."id")))))));

CREATE POLICY "Admins can manage team focus areas" ON "public"."team_focus_areas" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "ap"
  WHERE (("ap"."id" = "auth"."uid"()) AND ("ap"."role" = 'admin'::"text") AND ("ap"."company_id" = ( SELECT "p2"."company_id"
           FROM "public"."profiles" "p2"
          WHERE ("p2"."team_id" = "team_focus_areas"."team_id")))))));

CREATE POLICY "Admins can read their company" ON "public"."companies" FOR SELECT USING (("id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));

CREATE POLICY "Admins can update their company" ON "public"."companies" FOR UPDATE USING (("id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));

CREATE POLICY "Admins can view company tickets" ON "public"."tickets" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "ap"
  WHERE (("ap"."id" = "auth"."uid"()) AND ("ap"."role" = 'admin'::"text") AND ("ap"."company_id" = ( SELECT "p2"."company_id"
           FROM "public"."profiles" "p2"
          WHERE ("p2"."id" = "tickets"."customer_id")))))));

CREATE POLICY "Customers can create tickets" ON "public"."tickets" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'customer'::"text")))) AND ("customer_id" = "auth"."uid"())));

CREATE POLICY "Customers can view their own tickets" ON "public"."tickets" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'customer'::"text")))) AND ("customer_id" = "auth"."uid"())));

CREATE POLICY "Users can view focus areas in their company" ON "public"."focus_areas" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));

CREATE POLICY "allow_admin_update_company" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "admin"
  WHERE (("admin"."id" = "auth"."uid"()) AND ("admin"."role" = 'admin'::"text") AND ("admin"."company_id" = "profiles"."company_id"))))) WITH CHECK (("company_id" IN ( SELECT "admin"."company_id"
   FROM "public"."profiles" "admin"
  WHERE (("admin"."id" = "auth"."uid"()) AND ("admin"."role" = 'admin'::"text")))));

CREATE POLICY "allow_insert_during_signup" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));

CREATE POLICY "allow_select_company_members" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "self"
  WHERE (("self"."id" = "auth"."uid"()) AND ("self"."company_id" = "profiles"."company_id")))));

CREATE POLICY "allow_select_self" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));

CREATE POLICY "allow_update_self" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));

ALTER TABLE "public"."companies" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."focus_areas" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."team_focus_areas" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."tickets" ENABLE ROW LEVEL SECURITY;

ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

GRANT ALL ON FUNCTION "public"."get_companies"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_companies"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_companies"() TO "service_role";

GRANT ALL ON FUNCTION "public"."get_user_role"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_role"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"("user_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";

GRANT ALL ON TABLE "public"."companies" TO "anon";
GRANT ALL ON TABLE "public"."companies" TO "authenticated";
GRANT ALL ON TABLE "public"."companies" TO "service_role";

GRANT ALL ON SEQUENCE "public"."companies_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."companies_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."companies_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."focus_areas" TO "anon";
GRANT ALL ON TABLE "public"."focus_areas" TO "authenticated";
GRANT ALL ON TABLE "public"."focus_areas" TO "service_role";

GRANT ALL ON SEQUENCE "public"."focus_areas_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."focus_areas_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."focus_areas_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";

GRANT ALL ON TABLE "public"."team_focus_areas" TO "anon";
GRANT ALL ON TABLE "public"."team_focus_areas" TO "authenticated";
GRANT ALL ON TABLE "public"."team_focus_areas" TO "service_role";

GRANT ALL ON TABLE "public"."teams" TO "anon";
GRANT ALL ON TABLE "public"."teams" TO "authenticated";
GRANT ALL ON TABLE "public"."teams" TO "service_role";

GRANT ALL ON SEQUENCE "public"."teams_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."teams_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."teams_id_seq" TO "service_role";

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
