# Restore a demo backup

1. Create a **separate** empty PostgreSQL database. Do not restore into the active demo database.
2. Restore the matching `.dump` file with `pg_restore --no-owner --dbname "$RESTORE_DATABASE_URL" backups/cvrde-<timestamp>.dump`.
3. Restore the matching uploads archive into a fresh uploads volume: `tar -xzf backups/uploads-<timestamp>.tar.gz -C <uploads-directory>`.
4. Point a test API instance at that database and uploads directory. Log in and download a seeded attachment to verify both backups match.

The database URL must require TLS for Neon. Keep backup files encrypted and outside Git.
