# Backend Core — Day 1–4 Execution Log

## Pre-flight

Completed before coding:

- Read `README.md` and treated its locked architecture as authoritative.
- Confirmed the user’s boundary: backend-core only, stop after Day 4.
- Confirmed Docker availability and running services.
- Confirmed PostgreSQL 17 is reachable at `localhost:5433`.
- Confirmed `sortify_db` initially contained no application tables.
- Baseline Maven compilation succeeded before implementation.

## Day 1 — Architecture audit and migration baseline

Built:

- Added Flyway Core and PostgreSQL support dependencies.
- Added `V1__create_core_domain_schema.sql` for users, jobs, and candidates.
- Changed Hibernate from schema update to validation-only.
- Configured UTC JDBC timestamp handling.
- Added explicit scanning for the repository’s existing package layout.

Learned/recorded:

- PostgreSQL is the source of truth.
- Flyway owns DDL; Hibernate validates mappings.
- A passing Spring context is insufficient if repositories/entities are not discovered.

Verification: Flyway applied version 1 successfully to Docker PostgreSQL and Hibernate initialized against the migrated schema.

## Day 2 — User entity and uniqueness

Built:

- Completed the existing `User` entity mapping for `users`.
- Preserved string role persistence and timestamp fields.
- Kept the database-backed unique email constraint.

Verification: duplicate email persistence is rejected by PostgreSQL and covered by the integration test.

## Day 3 — Job entity and ownership relationship

Built:

- Implemented `Job` with title, JD, status, timestamps, and mandatory `User` relationship.
- Implemented `JobRepository`.
- Added `user_id` foreign key and index.

Verification: a job persisted with its owning user through the real PostgreSQL database.

## Day 4 — Candidate entity and ranking indexes

Built:

- Implemented `Candidate` with nullable processing fields, status, score, timestamps, and mandatory `Job` relationship.
- Implemented `CandidateRepository`.
- Added `(job_id, score DESC)` and `status` indexes.
- Added score range and status check constraints.

Verification: a candidate persisted and reloaded through the `Job → User` relationship in the integration test.

## Final checkpoint evidence

Command: `./mvnw.cmd clean test` through a temporary Docker TCP proxy because the host’s local PostgreSQL service occupied port 5433.

Result: build success; 3 JPA repositories discovered; Flyway version 1 validated and up-to-date; 3 tables were persisted and read through JPA; duplicate email was rejected; 3 tests passed against Docker PostgreSQL 17.10.

Database verification performed with Docker PostgreSQL:

- `flyway_schema_history` contains version 1.
- `users`, `jobs`, and `candidates` exist.
- Foreign keys and required indexes exist.
- The packaged application ran on the Docker network and returned HTTP 404 for the currently unmapped root route, confirming the web server was listening.

## Stopping point

Implementation stops here as requested. No Day 5 or later feature has been started.

## Local follow-up before the next checkpoint

The Windows PostgreSQL service `postgresql-x64-17` must be stopped or moved by an administrator before relying on host port 5433. The application’s committed default remains the Compose endpoint `localhost:5433`; Docker-network runtime verification is complete.
