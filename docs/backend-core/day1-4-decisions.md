# Backend Core — Day 1–4 Decisions

Status: complete

Scope: only `backend-core`, stopping after the Candidate entity checkpoint in the README.

## How the project plan was interpreted

The README is the active project plan. The user’s execution instructions take precedence over older notes in `docs/project-status.md`, `docs/backend-core/design.txt`, and `docs/DailyReport.txt`.

Those older notes describe Hibernate-created tables and a Node.js upload gateway. The locked README architecture says Flyway owns schema changes and Spring Boot owns API, ingestion, and transactional business logic. This checkpoint follows the locked architecture; Node.js, authentication endpoints, controllers, processing events, outbox, Redis, MinIO, and Python worker work remain outside Day 1–4.

## Decision 1 — One Flyway baseline for the Day 1–4 domain slice

The initial migration creates `users`, `jobs`, and `candidates` together. These tables form one relational foundation and are required for the three entity checkpoints. Splitting them into artificial daily migrations would make the database temporarily invalid at intermediate steps without adding useful history.

Implementation: `backend-core/src/main/resources/db/migration/V1__create_core_domain_schema.sql:1-44`.

Alternative: one migration per entity/day. Rejected for this initial empty database because the first coherent schema is easier to review and the future rule remains: every later schema change gets a new versioned migration.

## Decision 2 — Flyway is authoritative; Hibernate validates only

Flyway Core and its PostgreSQL database module were added to `pom.xml:55-62`. `spring.jpa.hibernate.ddl-auto=validate` and the Flyway location are configured in `application.properties:7-10`.

This ensures application startup fails when entity mappings and the actual schema disagree, while Hibernate cannot silently create, update, or drop production tables.

Alternative: `ddl-auto=update`. Rejected because it creates unreviewed schema changes and violates the project architecture.

## Decision 3 — Explicit application scanning for the existing package layout

The main class lives in `com.sortify.backendcore`, while feature packages (`user`, `job`, and `candidate`) are siblings under `com.sortify`. Explicit component, entity, and repository scanning is configured in `BackendCoreApplication.java:10-12`.

This was necessary because the first startup falsely looked healthy while discovering zero repositories. After the fix, startup discovers three JPA repositories and validates all three entities.

Alternative: move the main class to the `com.sortify` root package. That is also valid, but explicit scanning is the smallest safe change at this checkpoint and avoids changing package names.

## Decision 4 — Relationships use lazy, mandatory many-to-one associations

`Job` references `User` and `Candidate` references `Job` with `FetchType.LAZY` and non-null foreign keys. Implementations: `Job.java:42-44` and `Candidate.java:43-45`.

The database owns referential integrity through foreign keys in the migration. Lazy loading avoids automatically loading an entire object graph for every query; later API services will choose what to fetch and expose through DTOs.

Alternative: eager associations. Rejected because they increase query cost and can create accidental graph loading and N+1 behavior.

## Decision 5 — Status and role values are stored as readable strings

The entities use `@Enumerated(EnumType.STRING)`: `User.java:29-32`, `Job.java:51-54`, and `Candidate.java:58-61`. SQL check constraints mirror the currently supported enum values in the migration.

String values are readable in SQL and do not break when enum declaration order changes. The trade-off is that renaming an enum value requires a deliberate migration and coordinated code change.

Alternative: ordinal enum storage. Rejected because changing enum order would reinterpret existing data.

## Decision 6 — Candidate score and processing fields are nullable at creation

Candidates begin before asynchronous processing completes. `score`, `resume_key`, `failure_reason`, and `processed_at` are therefore nullable; `status` is mandatory and starts at `PENDING`. Implementation: `Candidate.java:47-68` and the migration at `V1__create_core_domain_schema.sql:26-41`.

This models the lifecycle without fake placeholder values. A score is constrained to 0–100 when present.

## Decision 7 — Indexes match the first planned read paths

The migration creates an index for job ownership lookup, `(job_id, score DESC)` for ranked candidates, and `status` for processing-state queries. SQL definitions are at `V1__create_core_domain_schema.sql:24 and 43-44`; JPA metadata mirrors them in `Job.java:28-30` and `Candidate.java:28-31`.

The unique email constraint creates the database-backed uniqueness guarantee required on `users.email`. This is tested in `BackendCoreApplicationTests.java:71-84`.

## Decision 8 — Normalize the JVM timezone before datasource startup

The host environment exposed the legacy `Asia/Calcutta` timezone ID. PostgreSQL rejected it during the JDBC startup handshake, before Hibernate settings could apply. `BackendCoreApplication.java:15-19` now normalizes the JVM default to UTC before Spring creates a datasource; the integration test applies the same normalization before loading its context.

Alternative: require every developer and deployment command to pass `-Duser.timezone=UTC`. Rejected as the only safeguard because it is easy to omit; a deployment can still override it explicitly when needed.

## Explicitly completed before stopping

- Flyway dependency and PostgreSQL support module added.
- Hibernate schema updates disabled and validation enabled.
- Versioned baseline migration applied successfully to Docker PostgreSQL.
- `User`, `Job`, and `Candidate` entity mappings implemented.
- `UserRepository`, `JobRepository`, and `CandidateRepository` are Spring Data repositories.
- Real PostgreSQL relationship persistence and duplicate email rejection verified.

## Deliberately not implemented

Day 5+ work was not started: `ProcessingEvent`, `OutboxEvent`, REST controllers, signup/login behavior, JWT filtering, MinIO, Redis, Python processing, frontend integration, and Testcontainers.
