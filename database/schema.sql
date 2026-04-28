--
-- PostgreSQL database dump
--

\restrict zYmlzbxPdMjH5h0nmfatlgfJgzhpczybS1NE4WA0JYIT0fD26KrvABEWzepdlKx

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account_interests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_interests (
    id integer NOT NULL,
    account_id character varying(36) NOT NULL,
    interest character varying(80) NOT NULL
);


--
-- Name: account_interests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.account_interests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: account_interests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.account_interests_id_seq OWNED BY public.account_interests.id;


--
-- Name: accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts (
    id character varying(36) NOT NULL,
    email character varying(320) NOT NULL,
    email_normalized character varying(320) NOT NULL,
    password_hash character varying(512) NOT NULL,
    display_name character varying(80) NOT NULL,
    email_verified_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    chat_access_restricted_at timestamp with time zone,
    chat_access_restriction_reason text,
    is_admin boolean DEFAULT false NOT NULL,
    chat_access_restriction_report_id integer,
    short_id character varying(6) NOT NULL,
    gender character varying(16) DEFAULT 'unknown'::character varying NOT NULL,
    stack_user_id character varying(128),
    CONSTRAINT ck_accounts_chat_access_restriction_consistency CHECK ((((chat_access_restricted_at IS NULL) AND (chat_access_restriction_reason IS NULL) AND (chat_access_restriction_report_id IS NULL)) OR ((chat_access_restricted_at IS NOT NULL) AND (chat_access_restriction_reason IS NOT NULL) AND (TRIM(BOTH FROM chat_access_restriction_reason) <> ''::text)))),
    CONSTRAINT ck_accounts_gender CHECK (((gender)::text = ANY ((ARRAY['male'::character varying, 'female'::character varying, 'unknown'::character varying])::text[])))
);


--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


--
-- Name: audit_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_events (
    id character varying(36) NOT NULL,
    account_id character varying(36),
    chat_session_id character varying(36),
    event_type character varying(120) NOT NULL,
    payload json NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: auth_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_sessions (
    id character varying(36) NOT NULL,
    account_id character varying(36) NOT NULL,
    token_hash character varying(128) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: chat_matches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_matches (
    id character varying(36) NOT NULL,
    left_chat_session_id character varying(36) NOT NULL,
    right_chat_session_id character varying(36) NOT NULL,
    started_at timestamp with time zone NOT NULL,
    ended_at timestamp with time zone,
    end_reason character varying(32),
    CONSTRAINT ck_chat_matches_distinct_sides CHECK (((left_chat_session_id)::text <> (right_chat_session_id)::text)),
    CONSTRAINT ck_chat_matches_ended_after_started CHECK (((ended_at IS NULL) OR (ended_at >= started_at)))
);


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id character varying(36) NOT NULL,
    chat_match_id character varying(36) NOT NULL,
    sender_chat_session_id character varying(36) NOT NULL,
    body text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL,
    client_message_id character varying(36),
    message_type character varying(16) NOT NULL,
    sender_display_name_snapshot character varying(80) NOT NULL,
    CONSTRAINT ck_chat_messages_body_nonempty CHECK ((TRIM(BOTH FROM body) <> ''::text)),
    CONSTRAINT ck_chat_messages_message_type CHECK (((message_type)::text = ANY ((ARRAY['text'::character varying, 'system'::character varying])::text[]))),
    CONSTRAINT ck_chat_messages_sender_display_name_nonempty CHECK ((TRIM(BOTH FROM sender_display_name_snapshot) <> ''::text))
);


--
-- Name: chat_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_reports (
    id integer NOT NULL,
    reporter_account_id character varying(36) NOT NULL,
    chat_match_id character varying(36) NOT NULL,
    reported_chat_session_id character varying(36) NOT NULL,
    reason character varying(32) NOT NULL,
    details text,
    status character varying(16) DEFAULT 'open'::character varying NOT NULL,
    created_at timestamp with time zone NOT NULL,
    reviewed_at timestamp with time zone,
    reviewed_by_account_id character varying(36),
    review_note text,
    CONSTRAINT ck_chat_reports_other_requires_details CHECK ((((reason)::text <> 'other'::text) OR ((details IS NOT NULL) AND (TRIM(BOTH FROM details) <> ''::text)))),
    CONSTRAINT ck_chat_reports_reason CHECK (((reason)::text = ANY ((ARRAY['harassment'::character varying, 'sexual_content'::character varying, 'spam'::character varying, 'hate_speech'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT ck_chat_reports_reviewed_at_consistency CHECK (((((status)::text = 'open'::text) AND (reviewed_at IS NULL) AND (reviewed_by_account_id IS NULL) AND (review_note IS NULL)) OR (((status)::text = ANY ((ARRAY['reviewed'::character varying, 'dismissed'::character varying, 'actioned'::character varying])::text[])) AND (reviewed_at IS NOT NULL) AND (reviewed_by_account_id IS NOT NULL) AND (review_note IS NOT NULL) AND (TRIM(BOTH FROM review_note) <> ''::text)))),
    CONSTRAINT ck_chat_reports_status CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'reviewed'::character varying, 'dismissed'::character varying, 'actioned'::character varying])::text[])))
);


--
-- Name: chat_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chat_reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chat_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chat_reports_id_seq OWNED BY public.chat_reports.id;


--
-- Name: chat_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_sessions (
    id character varying(36) NOT NULL,
    account_id character varying(36) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    last_seen_at timestamp with time zone NOT NULL,
    closed_at timestamp with time zone,
    display_name_snapshot character varying(80) NOT NULL,
    status character varying(16) NOT NULL,
    close_reason character varying(32),
    CONSTRAINT ck_chat_sessions_closed_at_consistency CHECK (((((status)::text = 'active'::text) AND (closed_at IS NULL)) OR (((status)::text = ANY ((ARRAY['closed'::character varying, 'expired'::character varying])::text[])) AND (closed_at IS NOT NULL)))),
    CONSTRAINT ck_chat_sessions_display_name_nonempty CHECK ((TRIM(BOTH FROM display_name_snapshot) <> ''::text)),
    CONSTRAINT ck_chat_sessions_status CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'closed'::character varying, 'expired'::character varying])::text[])))
);


--
-- Name: email_verification_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_verification_tokens (
    id character varying(36) NOT NULL,
    account_id character varying(36) NOT NULL,
    token_hash character varying(128) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    attempts integer DEFAULT 0 NOT NULL,
    CONSTRAINT ck_email_verification_tokens_not_both_consumed_and_revoked CHECK ((NOT ((consumed_at IS NOT NULL) AND (revoked_at IS NOT NULL))))
);


--
-- Name: news; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.news (
    id integer NOT NULL,
    title character varying(255)
);


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    id character varying(36) NOT NULL,
    account_id character varying(36) NOT NULL,
    token_hash character varying(128) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    CONSTRAINT ck_password_reset_tokens_not_both_consumed_and_revoked CHECK ((NOT ((consumed_at IS NOT NULL) AND (revoked_at IS NOT NULL))))
);


--
-- Name: registration_risk_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.registration_risk_events (
    id character varying(36) NOT NULL,
    account_id character varying(36),
    email_normalized character varying(320) NOT NULL,
    ip_hash character varying(128),
    user_agent character varying(512),
    outcome character varying(80) NOT NULL,
    details json NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: account_interests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_interests ALTER COLUMN id SET DEFAULT nextval('public.account_interests_id_seq'::regclass);


--
-- Name: chat_reports id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_reports ALTER COLUMN id SET DEFAULT nextval('public.chat_reports_id_seq'::regclass);


--
-- Name: account_interests account_interests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_interests
    ADD CONSTRAINT account_interests_pkey PRIMARY KEY (id);


--
-- Name: accounts accounts_email_normalized_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_email_normalized_key UNIQUE (email_normalized);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: audit_events audit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_pkey PRIMARY KEY (id);


--
-- Name: auth_sessions auth_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT auth_sessions_pkey PRIMARY KEY (id);


--
-- Name: auth_sessions auth_sessions_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT auth_sessions_token_hash_key UNIQUE (token_hash);


--
-- Name: chat_matches chat_matches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_matches
    ADD CONSTRAINT chat_matches_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: chat_reports chat_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_reports
    ADD CONSTRAINT chat_reports_pkey PRIMARY KEY (id);


--
-- Name: chat_sessions chat_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sessions
    ADD CONSTRAINT chat_sessions_pkey PRIMARY KEY (id);


--
-- Name: email_verification_tokens email_verification_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_pkey PRIMARY KEY (id);


--
-- Name: news news_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news
    ADD CONSTRAINT news_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: registration_risk_events registration_risk_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registration_risk_events
    ADD CONSTRAINT registration_risk_events_pkey PRIMARY KEY (id);


--
-- Name: account_interests uq_account_interest; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_interests
    ADD CONSTRAINT uq_account_interest UNIQUE (account_id, interest);


--
-- Name: accounts uq_accounts_display_name; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT uq_accounts_display_name UNIQUE (display_name);


--
-- Name: ix_account_interests_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_account_interests_account_id ON public.account_interests USING btree (account_id);


--
-- Name: ix_audit_events_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_audit_events_account_id ON public.audit_events USING btree (account_id);


--
-- Name: ix_audit_events_chat_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_audit_events_chat_session_id ON public.audit_events USING btree (chat_session_id);


--
-- Name: ix_audit_events_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_audit_events_expires_at ON public.audit_events USING btree (expires_at);


--
-- Name: ix_auth_sessions_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_auth_sessions_account_id ON public.auth_sessions USING btree (account_id);


--
-- Name: ix_auth_sessions_account_id_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_auth_sessions_account_id_expires_at ON public.auth_sessions USING btree (account_id, expires_at);


--
-- Name: ix_chat_matches_left_chat_session_id_started_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_chat_matches_left_chat_session_id_started_at ON public.chat_matches USING btree (left_chat_session_id, started_at);


--
-- Name: ix_chat_matches_right_chat_session_id_started_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_chat_matches_right_chat_session_id_started_at ON public.chat_matches USING btree (right_chat_session_id, started_at);


--
-- Name: ix_chat_matches_started_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_chat_matches_started_at ON public.chat_matches USING btree (started_at);


--
-- Name: ix_chat_messages_chat_match_id_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_chat_messages_chat_match_id_created_at ON public.chat_messages USING btree (chat_match_id, created_at);


--
-- Name: ix_chat_messages_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_chat_messages_expires_at ON public.chat_messages USING btree (expires_at);


--
-- Name: ix_chat_messages_sender_chat_session_id_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_chat_messages_sender_chat_session_id_created_at ON public.chat_messages USING btree (sender_chat_session_id, created_at);


--
-- Name: ix_chat_reports_chat_match_id_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_chat_reports_chat_match_id_created_at ON public.chat_reports USING btree (chat_match_id, created_at);


--
-- Name: ix_chat_reports_reported_chat_session_id_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_chat_reports_reported_chat_session_id_created_at ON public.chat_reports USING btree (reported_chat_session_id, created_at);


--
-- Name: ix_chat_reports_reporter_account_id_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_chat_reports_reporter_account_id_created_at ON public.chat_reports USING btree (reporter_account_id, created_at);


--
-- Name: ix_chat_reports_status_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_chat_reports_status_created_at ON public.chat_reports USING btree (status, created_at);


--
-- Name: ix_chat_sessions_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_chat_sessions_account_id ON public.chat_sessions USING btree (account_id);


--
-- Name: ix_chat_sessions_account_id_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_chat_sessions_account_id_created_at ON public.chat_sessions USING btree (account_id, created_at);


--
-- Name: ix_email_verification_tokens_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_email_verification_tokens_account_id ON public.email_verification_tokens USING btree (account_id);


--
-- Name: ix_email_verification_tokens_account_id_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_email_verification_tokens_account_id_created_at ON public.email_verification_tokens USING btree (account_id, created_at);


--
-- Name: ix_password_reset_tokens_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_password_reset_tokens_account_id ON public.password_reset_tokens USING btree (account_id);


--
-- Name: ix_password_reset_tokens_account_id_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_password_reset_tokens_account_id_created_at ON public.password_reset_tokens USING btree (account_id, created_at);


--
-- Name: ix_registration_risk_events_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_registration_risk_events_account_id ON public.registration_risk_events USING btree (account_id);


--
-- Name: ux_accounts_short_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_accounts_short_id ON public.accounts USING btree (short_id);


--
-- Name: ux_accounts_stack_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_accounts_stack_user_id ON public.accounts USING btree (stack_user_id);


--
-- Name: ux_chat_matches_active_left; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_chat_matches_active_left ON public.chat_matches USING btree (left_chat_session_id) WHERE (ended_at IS NULL);


--
-- Name: ux_chat_matches_active_right; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_chat_matches_active_right ON public.chat_matches USING btree (right_chat_session_id) WHERE (ended_at IS NULL);


--
-- Name: ux_chat_messages_match_client_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_chat_messages_match_client_message_id ON public.chat_messages USING btree (chat_match_id, client_message_id) WHERE (client_message_id IS NOT NULL);


--
-- Name: ux_chat_sessions_one_active_per_account; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_chat_sessions_one_active_per_account ON public.chat_sessions USING btree (account_id) WHERE ((status)::text = 'active'::text);


--
-- Name: account_interests account_interests_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_interests
    ADD CONSTRAINT account_interests_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: audit_events audit_events_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;


--
-- Name: audit_events audit_events_chat_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_chat_session_id_fkey FOREIGN KEY (chat_session_id) REFERENCES public.chat_sessions(id) ON DELETE SET NULL;


--
-- Name: auth_sessions auth_sessions_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT auth_sessions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: chat_matches chat_matches_left_chat_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_matches
    ADD CONSTRAINT chat_matches_left_chat_session_id_fkey FOREIGN KEY (left_chat_session_id) REFERENCES public.chat_sessions(id) ON DELETE CASCADE;


--
-- Name: chat_matches chat_matches_right_chat_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_matches
    ADD CONSTRAINT chat_matches_right_chat_session_id_fkey FOREIGN KEY (right_chat_session_id) REFERENCES public.chat_sessions(id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_match_id_fkey FOREIGN KEY (chat_match_id) REFERENCES public.chat_matches(id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_sender_chat_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_sender_chat_session_id_fkey FOREIGN KEY (sender_chat_session_id) REFERENCES public.chat_sessions(id) ON DELETE CASCADE;


--
-- Name: chat_reports chat_reports_chat_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_reports
    ADD CONSTRAINT chat_reports_chat_match_id_fkey FOREIGN KEY (chat_match_id) REFERENCES public.chat_matches(id) ON DELETE RESTRICT;


--
-- Name: chat_reports chat_reports_reported_chat_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_reports
    ADD CONSTRAINT chat_reports_reported_chat_session_id_fkey FOREIGN KEY (reported_chat_session_id) REFERENCES public.chat_sessions(id) ON DELETE RESTRICT;


--
-- Name: chat_reports chat_reports_reporter_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_reports
    ADD CONSTRAINT chat_reports_reporter_account_id_fkey FOREIGN KEY (reporter_account_id) REFERENCES public.accounts(id) ON DELETE RESTRICT;


--
-- Name: chat_reports chat_reports_reviewed_by_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_reports
    ADD CONSTRAINT chat_reports_reviewed_by_account_id_fkey FOREIGN KEY (reviewed_by_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;


--
-- Name: chat_sessions chat_sessions_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sessions
    ADD CONSTRAINT chat_sessions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: email_verification_tokens email_verification_tokens_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: password_reset_tokens password_reset_tokens_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: registration_risk_events registration_risk_events_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registration_risk_events
    ADD CONSTRAINT registration_risk_events_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict zYmlzbxPdMjH5h0nmfatlgfJgzhpczybS1NE4WA0JYIT0fD26KrvABEWzepdlKx
