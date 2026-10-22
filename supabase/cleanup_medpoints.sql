-- =========================================================
-- MEDLINK KE — REMOVE MEDPOINTS OBJECTS FROM LIVE SUPABASE
-- ---------------------------------------------------------
-- Purpose: undoes the MedPoints tables, views and functions
-- that were added to supabase/schema.sql and (possibly) run
-- against the live database.
--
-- Safe to run more than once (everything is guarded with
-- "if exists").
--
-- What this KEEPS (untouched):
--   profiles, posts, comments, likes, resources, communities,
--   messages, study sessions, roles, suspensions, activity_log
--   and all your original data.
--
-- What this REMOVES (MedPoints-only objects):
--   medpoint_transactions, medpoint_levels, medpoint_totals,
--   medpoint_achievements, user_achievements,
--   daily_missions_def, daily_missions,
--   all medpoint/mission/leaderboard functions,
--   profiles.medpoint_level and profiles.leaderboard_opt_out.
--
-- WARNING: medpoint_transactions holds the history of MedPoints
-- already earned. Dropping it discards that history. If you want
-- to keep a copy first, run a backup or:
--   select * from medpoint_transactions;  -- note the rows down
-- =========================================================

-- 1) Drop the view first (it depends on medpoint_transactions)
drop view if exists public.medpoint_totals;

-- 2) Drop functions that reference MedPoints tables
drop function if exists public.claim_daily_mission(bigint);
drop function if exists public.get_or_create_daily_missions(text);
drop function if exists public.leaderboard_consistent_learners(integer);
drop function if exists public.leaderboard_question_helpers(integer);
drop function if exists public.leaderboard_resource_contributors(integer);
drop function if exists public.leaderboard_top_contributors(integer);
drop function if exists public.check_and_award_achievements(text);
drop function if exists public.update_user_medpoint_level(text);
drop function if exists public.award_medpoints(text, integer, text, text, jsonb);

-- 3) Drop the MedPoints tables (cascade removes their policies/indexes)
drop table if exists public.daily_missions cascade;
drop table if exists public.daily_missions_def cascade;
drop table if exists public.user_achievements cascade;
drop table if exists public.medpoint_achievements cascade;
drop table if exists public.medpoint_transactions cascade;
drop table if exists public.medpoint_levels cascade;

-- 4) Remove the columns the MedPoints work added to profiles
alter table public.profiles drop column if exists medpoint_level;
alter table public.profiles drop column if exists leaderboard_opt_out;

-- Done. Your original MedLink schema is now active again.
