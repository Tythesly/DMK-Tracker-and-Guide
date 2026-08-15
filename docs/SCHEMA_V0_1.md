# DMK Tracker and Guide - Database Schema v0.1

## Purpose

This document defines the first database schema that will be implemented for
the DMK Tracker and Guide application.

Schema v0.1 supports the first development milestone:

DMK App v0.1 - Character Tracking Foundation

This is intentionally a small implementation of the larger data model.

---

# Database Files

Two SQLite databases will be used.

## dmk-data.db

Contains authoritative Disney Magic Kingdoms game data.

This database may be replaced or upgraded when a new DMK data update is
installed.

## dmk-player.db

Contains the individual player's progress.

This database must survive game-data updates.

The application must never replace dmk-player.db simply because dmk-data.db
has been updated.

---

# Important Cross-Database Rule

Player records will store game stable IDs as TEXT values.

The player database will NOT use SQLite foreign-key constraints pointing into
dmk-data.db.

For example:

character_progress.character_id

may contain:

character_mickey_mouse

The application resolves that ID against dmk-data.db when displaying the
character.

This is intentional.

It allows player progress to remain intact even if a newer or older game
database temporarily does not contain the referenced record.

---

# Stable ID Format

Stable IDs should use:

- Lowercase letters
- Numbers where needed
- Underscores
- A record-type prefix

Examples:

collection_mickey_friends

character_mickey_mouse

token_mickey_balloon

token_mickey_ears

Once publicly released, a stable ID must not change merely because the
visible name changes.

---

# dmk-data.db

## metadata

Stores information about the installed DMK database.

Fields:

- key
- value

Expected metadata keys may include:

- schema_version
- data_version
- game_version
- source_workbook_version
- build_timestamp
- minimum_app_version
- package_id

SQL:

```sql
CREATE TABLE metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);