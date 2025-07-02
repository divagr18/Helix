--
-- PostgreSQL database cluster dump
--

SET default_transaction_read_only = off;

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

--
-- Roles
--

CREATE ROLE helix;
ALTER ROLE helix WITH SUPERUSER INHERIT CREATEROLE CREATEDB LOGIN REPLICATION BYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:BuRKtbftNGQD/fbYhmUoBg==$WJkuJhWGoimbZvaeEfsJVgu0HvLMkcmNHW6bOiwjq6E=:rBqkRj5vsfuic4ACxfqVzERxEqFnvRtZXKyCmHtmuP4=';
CREATE ROLE helix_readonly;
ALTER ROLE helix_readonly WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:wUiBK+1BQq5kyk/1SEfP1Q==$6uyJU8aGxaFCgVG/cp3fF20d2BlSzSdX7EIQNhl6Wyk=:cgsoHjmZGYQfy+jfx1r5IatazcNR47aedZGBwaKCf/Q=';

--
-- User Configurations
--






--
-- PostgreSQL database cluster dump complete
--

