\# DMK Tracker and Guide - Application Architecture



\## Project Purpose



DMK Tracker and Guide is a Windows-first desktop application for tracking

player progress and providing guides, calculations, planning tools, and

reference information for Disney Magic Kingdoms.



The application is intended to eventually replace most player-facing

functionality currently provided by the DMK Tracker and Guide workbook.



\---



\## Core Technology



\- Desktop Framework: Tauri 2

\- Frontend: React

\- Language: TypeScript

\- Native Backend: Rust

\- Game Database: SQLite

\- Primary Platform: Windows

\- Internet Connection: Not required for normal use



\---



\## Privacy and Player Data



The application will be local-first.



There will be:



\- No user accounts

\- No login system

\- No cloud saves

\- No server-side player progress

\- No requirement to connect to the internet



Player progress will remain on the player's own computer.



The application will automatically save progress locally.



Players will also be able to manually:



\- Export a backup

\- Import a backup

\- Restore their progress on another installation



\---



\## Game Data and Player Data



Game data and player progress must remain separate.



\### Game Data



Game data includes information such as:



\- Collections

\- Characters

\- Character levels

\- Tokens

\- Token activities

\- Costumes

\- Attractions

\- Attraction enchantment levels

\- Quests

\- Quest prerequisites

\- Floats

\- Decorations

\- Concessions

\- Sources

\- Update history



Game data will eventually be stored in:



dmk-data.db



\### Player Data



Player data includes information such as:



\- Character unlocked status

\- Character levels

\- Current token inventory

\- Costume progress

\- Attraction ownership

\- Attraction enchantment levels

\- Quest completion

\- Owned park inventory

\- Favorites

\- Priorities

\- Personal notes

\- Application preferences



A game-data update must never overwrite player progress.



\---



\## Stable IDs



Every important DMK record must have a permanent stable ID.



Examples include:



\- Characters

\- Collections

\- Tokens

\- Attractions

\- Quests

\- Costumes

\- Activities

\- Decorations

\- Concessions



Visible names may change without changing the permanent ID.



Player progress should reference permanent IDs rather than visible names

whenever possible.



\---



\## Compatibility Aliases



The application and data tools will support cumulative aliases.



Aliases allow older names to safely resolve to their corrected or current

records.



Previously supported aliases must not be removed when new aliases are added.



This will allow users to migrate or import older data without requiring every

intermediate release.



\---



\## Forward References



The DMK data system must support unresolved or forward references during

editing.



For example, a quest or activity may reference a character that has not yet

been added to the main character list.



This reference should be preserved and reported by validation rather than

destroyed.



Once the corresponding record is later added, the reference can become fully

linked.



\---



\## Data Source



Initially, the existing DMK Master workbook remains the authoritative editor

and source for game data.



The planned data pipeline is:



DMK Master Workbook

&#x20;       |

&#x20;       v

DMK Data Builder / Validator

&#x20;       |

&#x20;       v

dmk-data.db

&#x20;       |

&#x20;       v

Signed .dmkupdate Package

&#x20;       |

&#x20;       v

DMK Tracker and Guide Application



The Data Builder / Validator will eventually:



\- Read the Master workbook

\- Preserve stable IDs

\- Preserve cumulative aliases

\- Validate relationships

\- Detect unresolved references

\- Compare previous and new game data

\- Generate dmk-data.db

\- Generate signed .dmkupdate packages

\- Produce machine-readable validation reports

\- Produce machine-readable change reports



\---



\## Application Layers



The application will be divided into separate logical systems.



\### 1. Game Data Layer



Provides authoritative DMK information.



\### 2. Player Progress Layer



Stores information specific to an individual player.



\### 3. Calculation Engine



Performs calculations such as:



\- Remaining token requirements

\- Character leveling requirements

\- Time estimates

\- Token bottlenecks

\- Token conflicts

\- Attraction blueprint requirements

\- Upgrade planning

\- Progress percentages

\- Smart recommendations



\### 4. User Interface



React-based player-facing screens.



\### 5. Backup and Restore



Handles safe export and import of player progress.



\### 6. Game Data Update System



Installs verified DMK game-data updates without affecting player progress.



\### 7. Application Update System



Updates the application itself independently of DMK game-data updates.



\---



\## Update Security



Application updates and DMK game-data updates are separate systems.



DMK game-data packages will use the .dmkupdate format.



Update packages should be cryptographically verified before installation.



The application must support:



\- Optional online game-data update checks

\- Fully offline manual .dmkupdate installation

\- Application updates separately from game-data updates



\---



\## First Development Milestone



The first working milestone is:



DMK App v0.1 - Character Tracking Foundation



The application must be able to:



1\. Start successfully.

2\. Read real DMK character data.

3\. Display a character.

4\. Allow a player to set whether the character is unlocked.

5\. Allow a player to set the character's level.

6\. Allow a player to enter current token quantities.

7\. Save that progress locally.

8\. Close completely.

9\. Reopen.

10\. Restore the player's saved progress correctly.



Completing this milestone will prove that the core architecture works before

larger DMK systems are added.



\---



\## Development Principles



\- Correctness is more important than speed.

\- Keep dependencies to a minimum.

\- Game data and player progress must never be mixed.

\- Preserve backward compatibility wherever practical.

\- Use stable permanent IDs.

\- Maintain cumulative aliases.

\- Add automated regression tests as features are implemented.

\- Validate calculations against known workbook behavior.

\- Keep the application runnable after each development session.

\- Use Git checkpoints before major changes.

\- Do not treat automated validation as a replacement for detailed release

&#x20; auditing.

