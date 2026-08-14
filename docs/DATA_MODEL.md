# DMK Tracker and Guide - Data Model

## Purpose

This document defines how Disney Magic Kingdoms game data and player progress
will be represented inside the DMK Tracker and Guide application.

The goals of the data model are:

* Keep DMK game data separate from player progress.
* Give every important record a permanent stable ID.
* Allow visible names to be corrected without breaking player data.
* Preserve compatibility with older workbook and application releases.
* Support cumulative aliases.
* Support forward and unresolved references during data editing.
* Allow game-data updates without overwriting player progress.
* Support future features without requiring the database to be redesigned.
* Keep the model understandable and maintainable.

---

# Database Separation

The application will use separate storage for game data and player data.

## Game Database

Planned file:

`dmk-data.db`

This contains authoritative Disney Magic Kingdoms information.

Examples:

* Collections
* Characters
* Tokens
* Character level requirements
* Token activities
* Attractions
* Attraction enchantment levels
* Quests
* Quest prerequisites
* Costumes
* Floats
* Decorations
* Concessions
* Sources
* Game updates
* Aliases

Game-data updates may replace or upgrade this database.

They must not overwrite player progress.

---

## Player Database

Planned file:

`dmk-player.db`

This contains information entered or changed by the player.

Examples:

* Character unlocked status
* Character levels
* Current token inventory
* Costume progress
* Attraction ownership
* Attraction enchantment levels
* Completed quests
* Owned concessions
* Owned decorations
* Favorites
* Priorities
* Personal notes
* Application preferences

A DMK game-data update must never replace this database.

---

# Stable ID Rules

Every important game-data record receives a permanent stable ID.

Stable IDs are used internally instead of relying on visible names.

Example:

Visible name:

`Mickey Mouse`

Possible stable ID:

`character_mickey_mouse`

If the visible name is later corrected or changed, the stable ID remains:

`character_mickey_mouse`

Stable IDs must:

1. Be unique.
2. Never be reused for a different record.
3. Never change simply because a visible name changes.
4. Be preserved across all future DMK data releases.
5. Be used by player progress whenever possible.
6. Be included in migration and update compatibility logic.

Human-readable IDs are preferred because they make validation and debugging
easier.

Once an ID has been released, it is considered permanent.

---

# Deleted or Retired Records

Records should not normally be physically deleted simply because they are no
longer available in the game.

Where appropriate, records should instead support states such as:

* Active
* Retired
* Historical
* Unavailable
* Limited-time

This allows old player progress, historical information, update history, and
source information to remain valid.

If a game record must be removed from current game data, player progress that
references its stable ID must still be preserved.

The application must never silently delete player progress because a game-data
record is missing.

---

# Collections

Collections group related characters and other DMK content.

Each collection should support information such as:

* Stable ID
* Display name
* Sort/display order
* Permanent or limited-time status
* Current availability
* Introduction/update information
* Notes
* Active/retired state

Conceptual example:

| Stable ID                   | Display Name     |
| --------------------------- | ---------------- |
| `collection_mickey_friends` | Mickey & Friends |
| `collection_toy_story`      | Toy Story        |
| `collection_cinderella`     | Cinderella       |

Characters reference their collection by stable ID.

A visible collection name may change without requiring character records or
player progress to change.

---

# Characters

Each character is represented by one permanent character record.

A character should support information such as:

* Stable ID
* Display name
* Collection stable ID
* Maximum level
* Permanent or limited-time status
* Premium status where applicable
* Unlock method
* Welcome cost
* Welcome time
* Introduction/update information
* Current availability
* Notes
* Active/retired state

Conceptual example:

| Stable ID                | Display Name | Collection                  |
| ------------------------ | ------------ | --------------------------- |
| `character_mickey_mouse` | Mickey Mouse | `collection_mickey_friends` |
| `character_goofy`        | Goofy        | `collection_mickey_friends` |

Character names must never be used as the sole key for player progress.

Player progress references:

`character_mickey_mouse`

rather than relying on the text:

`Mickey Mouse`

---

# Tokens and Resources

Tokens are independent game-data records.

Tokens must not be identified only by their visible names.

A token should support information such as:

* Stable ID
* Display name
* Token type
* Associated character where applicable
* Associated collection where applicable
* Associated costume where applicable
* Icon/image reference
* Current availability
* Introduction/update information
* Notes
* Active/retired state

Token types may include:

* Collection/Common Token
* Character Token
* Ears Hat Token
* Costume Token
* Fabric Token
* Other future resource types

Conceptual examples:

| Stable ID              | Display Name                | Type            |
| ---------------------- | --------------------------- | --------------- |
| `token_mickey_balloon` | Mickey Balloon Token        | Character Token |
| `token_mickey_ears`    | Mickey Mouse Ears Hat Token | Ears Hat Token  |

The data model must not assume that every character will always have exactly
the same number or type of token requirements.

---

# Character Level Requirements

Character leveling requirements should be stored as data rather than being
hard-coded into the application.

Each requirement connects:

* Character stable ID
* Target level
* Required resource/token stable ID
* Required quantity

Additional level information may include:

* Magic cost
* Level-up time
* Special requirements

Conceptual example:

Mickey Mouse upgrading to Level 5 may require several separate requirement
records:

* Mickey common/collection token
* Mickey Balloon Token
* Mickey Ears Hat Token
* Magic

This design allows future characters with different requirement structures to
work without changing application code.

---

# Player Character Progress

Player character information belongs only in the player database.

For each character, the player database may store:

* Character stable ID
* Unlocked status
* Current level
* Ready-to-welcome status where applicable
* Ready-to-level status where applicable
* Personal priority
* Favorite status
* Personal notes
* Last modified date

The game database determines what levels and requirements exist.

The player database determines where the player currently is.

---

# Player Token Inventory

Token quantities entered by a player belong only in the player database.

Each entry connects:

* Token stable ID
* Current quantity
* Last modified date

Example:

| Token Stable ID        | Player Quantity |
| ---------------------- | --------------: |
| `token_mickey_balloon` |              14 |
| `token_mickey_ears`    |               8 |

The calculation engine will compare these quantities against game-data
requirements.

This will allow calculations such as:

* Tokens still needed
* Characters ready to level
* Characters closest to leveling
* Time-to-level estimates
* Time-to-max estimates
* Token bottlenecks
* Token conflicts
* Recommended activities

---

# Activities

Token-producing activities should be modeled independently from tokens.

An activity may represent sources such as:

* Character task
* Joint character task
* Attraction activity
* Parade float
* Chest or other source
* Shop or Elixir purchase
* Other future activity types

An activity should support information such as:

* Stable ID
* Display/activity name
* Activity type
* Duration
* Availability
* Introduction/update information
* Notes
* Active/retired state

Activities may involve multiple characters or requirements.

Therefore, character involvement should not be stored as one fixed
"Character" column inside the activity itself.

Relationships should allow:

`Activity -> one or more Characters`

and:

`Activity -> one or more Token Rewards`

This is necessary for future token-conflict calculations.

---

# Activity Rewards

Activities and token rewards use a many-to-many relationship.

One activity may reward multiple tokens.

One token may be available from multiple activities.

Conceptually:

`Activity A -> Mickey Balloon Token`

`Activity B -> Mickey Balloon Token`

`Activity B -> Another Token`

This relationship will allow the calculation engine to determine when two
characters compete for the same activity.

---

# Activity Requirements

Activities may have requirements such as:

* One character
* Multiple characters
* Minimum character level
* Attraction ownership
* Attraction enchantment level
* Costume
* Quest completion
* Other future conditions

Requirements should be stored as data rather than embedded in application
code.

This allows the app to determine whether an activity is currently available
to a particular player.

---

# Attractions

Each attraction receives a permanent stable ID.

Attraction information may include:

* Stable ID
* Display name
* Collection/theme association
* Enchantable status
* Maximum enchantment level
* Unlock/acquisition method
* Elixir cost where applicable
* Introduction/update information
* Current availability
* Notes
* Active/retired state

Player attraction ownership and enchantment level belong in the player
database, not the game database.

---

# Attraction Enchantment Requirements

Attraction upgrade requirements should be represented as data.

The required blueprint rarity must correspond to the level being upgraded to:

* Level 1 -> Common Blueprints
* Level 2 -> Uncommon Blueprints
* Level 3 -> Rare Blueprints
* Level 4 -> Epic Blueprints
* Level 5 -> Legendary Blueprints

Requirements may also include:

* Collection relics
* Tokens/resources
* Magic
* Upgrade time
* Other future requirements

The calculation engine must use the player's current attraction level when
determining remaining blueprint requirements.

---

# Quests

Each quest receives a permanent stable ID.

Quest information may include:

* Stable ID
* Display name
* Collection/storyline
* Quest type
* Primary character
* Duration
* Requirements
* Rewards
* Introduction/update information
* Notes
* Active/retired state

Quest IDs must remain stable even if the visible quest name is corrected.

Player quest completion belongs in the player database.

---

# Quest Prerequisites

Quest prerequisites must support relationships such as:

* Quest requires another quest
* Quest requires a character
* Quest requires a character level
* Quest requires an attraction
* Quest requires an attraction level
* Quest requires a costume
* Other future prerequisite types

The model must support multiple prerequisites for one quest.

This structure will eventually power visual quest prerequisite trees.

---

# Costumes

Each costume receives a permanent stable ID.

Costume information may include:

* Stable ID
* Display name
* Character stable ID
* Costume type
* Unlock/acquisition method
* Introduction/update information
* Availability
* Notes
* Active/retired state

Costume requirements should use resource/token relationships rather than
hard-coded application logic.

Player costume progress belongs in the player database.

---

# Park Inventory

Decorations and concessions should be represented as individual game-data
records.

Information may include:

* Stable ID
* Display name
* Item type
* Category
* Rarity
* Collection/theme
* Acquisition method
* Current obtainability
* Limited-time status
* Historical acquisition information
* Introduction/update information
* Source/reference information
* Notes
* Active/retired state

The app should distinguish between states such as:

* Currently obtainable
* Limited-time
* Historical
* Currently unavailable
* Unknown

Player ownership belongs in the player database.

This data will eventually power the Park Inventory acquisition guide and
"How do I obtain this?" features.

---

# Aliases

Aliases provide compatibility when names or identifiers change.

Each alias should contain information such as:

* Alias text
* Record type
* Target stable ID
* Version first supported
* Reason/notes

Example:

Old attraction name:

`Pooh’s Honey Hunt`

Corrected display name:

`Pooh's Hunny Hunt`

Both should resolve to the same permanent attraction stable ID.

Aliases are cumulative.

Once an alias has been supported publicly, future data tools should retain it
unless there is an exceptional, explicitly audited reason to remove it.

An alias must never silently be reassigned to an unrelated record.

---

# Forward and Unresolved References

The authoritative editing system may reference a record before that record has
been added to its main list.

Example:

A token activity may reference a future character.

The Data Builder / Validator must:

1. Preserve the original reference.
2. Attempt to resolve it through stable IDs and aliases.
3. Mark it as unresolved if the target does not yet exist.
4. Report the unresolved reference.
5. Avoid silently deleting or changing it.
6. Automatically resolve it in a later build when the corresponding record
   becomes available.

An unresolved reference is not automatically considered fatal.

Validation severity will depend on whether that relationship is required for
the released application to function correctly.

---

# Source and Update History

Important game-data records should be able to reference source information.

Source information may include:

* DMK Wiki page
* Official game update notes
* Official social/media announcement
* Manual verification notes
* Workbook source notes
* Date verified

The database should also track when records were:

* Added
* Modified
* Retired
* Corrected

This will eventually power item history and the application's Update Explorer.

---

# Game Data Metadata

Every generated `dmk-data.db` should contain release metadata.

Planned metadata includes:

* Data schema version
* DMK data version
* Covered game version
* Source workbook version
* Build date
* Minimum compatible application version
* Data package identifier
* Validation status
* Data checksum/hash where appropriate

This helps the application determine whether an update is valid and
compatible.

---

# Player Progress Preservation

Player progress must be preserved even when:

* A game-data record is renamed.
* An alias is added.
* Display order changes.
* A record becomes unavailable.
* A record is retired.
* A newer game database does not currently contain the referenced record.

Player records must not use cascading deletion against game-data records.

Missing game-data references should be treated as orphaned/preserved progress
until they can be resolved.

---

# Calculation Engine Boundary

The database stores facts.

The calculation engine interprets those facts.

Examples:

The database stores:

* Character level requirements
* Current player level
* Current token quantities
* Activity duration
* Available token sources

The calculation engine determines:

* Tokens remaining
* Whether a character is ready to level
* Estimated completion time
* Bottleneck token
* Conflicting activities
* Best activity choices
* Recommended character priorities

Calculation rules should not be unnecessarily embedded inside individual UI
screens.

This allows calculations to be independently tested against expected workbook
results.

---

# Initial Development Scope

The first implementation will not build every table described in this
document.

The first vertical slice will concentrate on:

1. Collections
2. Characters
3. Tokens
4. Character level requirements
5. Player character progress
6. Player token inventory

This is enough to build and test the first Character Tracker while keeping the
database architecture compatible with future DMK features.

Once this foundation is proven, additional systems will be added
incrementally.

---

# Data Model Principles

* Stable IDs are permanent.
* Visible names are not database identities.
* Game data and player progress remain separate.
* Player data must survive game-data updates.
* Aliases are cumulative.
* Unresolved references are preserved rather than silently discarded.
* Requirements should be represented as data whenever practical.
* Many-to-many relationships should be used where the game permits multiple
  relationships.
* Do not hard-code current DMK assumptions when the database can represent
  them safely.
* Historical information should be preserved where useful.
* Database schema changes must be versioned.
* Data migrations must be testable and reversible where practical.
* Correctness takes priority over convenience.
