# Backend Core — Errors and Troubleshooting Log

## Issue 1 — Hibernate was configured to update the schema

Status: fixed.

### Symptom

`spring.jpa.hibernate.ddl-auto=update` allowed Hibernate to create or modify tables implicitly, contrary to the locked project architecture.

### Cause

The existing application properties predated the Flyway decision in the README.

### Fix

Added Flyway dependencies and the versioned baseline migration. Changed the property to `spring.jpa.hibernate.ddl-auto=validate` and configured the migration location.

### Verification

`./mvnw.cmd clean test` completed successfully. Startup logs reported Flyway validation and migration, followed by Hibernate EntityManager initialization without schema update statements.

## Issue 2 — Initial startup discovered zero repositories

Status: fixed.

### Symptom

The application context started, but Spring Data reported `Found 0 JPA repository interfaces`. This was a silent false-positive: the context test passed without actually testing the feature repositories.

### Cause

`BackendCoreApplication` was in `com.sortify.backendcore`, while feature packages were siblings under `com.sortify`, outside Spring Boot’s default component/entity/repository scan root.

### Fix

Configured `scanBasePackages`, `@EntityScan`, and `@EnableJpaRepositories` for `com.sortify` in `BackendCoreApplication.java:10-12`.

### Verification

The next startup reported `Found 3 JPA repository interfaces`. The persistence integration test then successfully saved and reloaded the `User → Job → Candidate` relationship.

## Issue 3 — Placeholder repository classes were not Spring Data repositories

Status: fixed.

### Symptom

`JobRepository` and `CandidateRepository` were ordinary empty classes, so they could not provide JPA persistence operations.

### Fix

Converted both to interfaces extending `JpaRepository` at `JobRepository.java:6` and `CandidateRepository.java:6`.

### Verification

The application discovered three repositories and the integration test persisted records through all three.

## Non-blocking warnings observed

- Spring reports `spring.jpa.open-in-view` is enabled by default. No web data access is in scope for Day 1–4; this should be reviewed when controllers and DTOs are implemented.
- Spring Security reports a generated development password because authentication behavior is not yet implemented. JWT and security hardening are explicitly Day 14+ work.
- Mockito/JDK dynamic-agent warnings appear during tests. They do not fail the build and should be revisited if the test suite begins using Mockito heavily.

## Issue 4 — Docker PostgreSQL rejected `Asia/Calcutta`

Status: fixed.

### Symptom

The Docker-backed test connection failed with `FATAL: invalid value for parameter "TimeZone": "Asia/Calcutta"`.

### Cause

The host JVM timezone identifier was `Asia/Calcutta`, which PostgreSQL 17 does not accept during the JDBC startup handshake. The JPA UTC property cannot help because the connection must be established first.

### Fix

Normalized the JVM default timezone to UTC in the static bootstrap block at `BackendCoreApplication.java:15-19`, before Spring creates the datasource. The integration test class also sets UTC in its static initializer because Spring’s test context does not invoke the application’s `main` method.

### Verification

The proxy-backed Maven test is rerun after this fix against the Docker PostgreSQL container. The existing repository history had noted this class of problem, but it was not enforced by the application code until now.

## Issue 5 — Host port 5433 was shadowed by local PostgreSQL

Status: worked around for verification; local machine cleanup remains required.

### Symptom

The host-side Maven test connected to PostgreSQL 17.8 and reported successful migrations, but Docker `psql` showed no application tables. The Docker container is PostgreSQL 17.10.

### Cause

The Windows `postgresql-x64-17` service was also listening on host port 5433. Attempts to stop it from this non-administrator shell failed with access denied.

### Workaround and verification

The live application was run inside a temporary container on the Docker Compose network, using `sortify-postgres:5432`. Maven integration tests were run through a temporary Docker TCP proxy on host port 15433. Both paths reached PostgreSQL 17.10; the proxy and application check containers were removed afterward.

### Follow-up

Before normal host-side development, stop or reconfigure the Windows PostgreSQL service with administrator privileges, then keep the Compose mapping `5433:5432`. No local or Docker database data was deleted.
