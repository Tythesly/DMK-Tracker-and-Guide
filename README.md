# DMK Tracker and Guide

**DMK Tracker and Guide** is an in-development desktop companion for **Disney Magic Kingdoms** designed to make it easier to track characters, tokens, attractions, quests, collections, and overall player progress.

The goal is to build a comprehensive tracker and guide that combines progress tracking, planning tools, game information, and useful recommendations in one application while keeping each player's personal progress stored locally on their own device.

> **Development Status: Early Development**
>
> This application is currently under active development and is **not yet ready for general player use**. This repository is public so anyone interested can follow the project as it grows.

## Current Development Progress

The current prototype already supports:

* Dynamic character loading from the game database
* Character Welcome and level tracking
* Persistent local player progress
* Automatic local saving
* Individual character token inventories
* Shared token inventory between characters
* Global player Magic tracking
* Welcome token, Magic, and time requirements
* Level-up token, Magic, and time requirements
* Remaining-token calculations
* **Ready to Welcome** calculations
* **Ready to Level Up** calculations
* Separate game-data and player-progress databases
* Player progress that survives game-data replacement and updates

Development is currently using a small set of test data while the application's core systems are built and verified.

## Planned Features

The finished application is intended to include much more than basic character tracking, including:

* Complete character and collection tracking
* Character token inventories and level planning
* Character costumes
* Quest tracking
* Quest prerequisite trees
* Attractions and attraction enchantment tracking
* Attraction upgrade planning and blueprint requirements
* Parade floats
* Park inventory tracking
* Concessions and decorations
* Information about how park items can or could be obtained
* Token activity and source information
* Token conflict planning
* Activity-time planning
* Universal search across game content
* Favorites, priorities, and personal notes
* What-if planning and simulation tools
* Progress snapshots
* Smart recommendations for useful next actions
* Detailed game-data update information
* An update explorer showing what changed between updates
* Local backup and restore through Export/Import
* Offline game-data update packages
* Optional online checks for new game-data updates

The feature set will continue to evolve as development progresses.

## Local-First by Design

Player privacy and long-term data ownership are important parts of the project.

DMK Tracker and Guide is being designed as a **local-first application**.

Player progress is stored on the player's own device. The project is not being designed around:

* User accounts
* Required logins
* Cloud saves
* Cloud synchronization
* Server-side storage of player progress

The application will eventually support manual Export/Import backups so players can keep their own backup copies or move their progress between devices.

## Game Data and Player Progress

Game information and player progress are intentionally stored separately.

This means the game's database can be updated or replaced as Disney Magic Kingdoms receives new content without replacing the player's personal progress.

Characters, tokens, attractions, quests, and other game records use stable identifiers so player data can continue to reference the correct content even when names or other game information change.

## Game Data Updates

Application updates and Disney Magic Kingdoms data updates are being designed as separate systems.

The goal is for players to eventually be able to update the application's game information without needing to reinstall the entire application every time new DMK content is added.

Offline/manual game-data updates are also planned so the core tracker does not require a constant Internet connection.

## Platform

The application is currently being developed as a **Windows-first desktop application** using:

* Tauri 2
* React
* TypeScript
* Rust
* SQLite

Support for additional platforms may be considered later, but Windows is the primary development target.

## Public Releases

There are currently **no supported public releases** of the application.

The source repository is public so development progress can be followed, but the application is still being built and tested.

A downloadable release will be provided when the project reaches a point where it is suitable for normal player use.

## Project Goals

The long-term goal is to create a DMK companion that can answer questions such as:

* Which characters are ready to level?
* Which characters are closest to leveling?
* How many tokens do I still need?
* Which characters are competing for the same token sources?
* What should I work on before I next check the game?
* What attractions should I upgrade?
* How many blueprints will those upgrades require?
* What quests are blocking later content?
* How can I obtain an item I'm missing?
* What changed in the latest DMK update?
* How long could it take to finish a character or collection?

The intention is for the application to become both a **complete progress tracker** and a **practical planning guide** rather than simply reproducing information already available elsewhere.

## Disclaimer

DMK Tracker and Guide is an **unofficial, fan-made project** for Disney Magic Kingdoms players.

This project is not affiliated with, endorsed by, sponsored by, or officially connected with **Gameloft, Disney, or their affiliates**.

Disney Magic Kingdoms and all related names, characters, artwork, trademarks, and other intellectual property belong to their respective owners.

## Development

Development is ongoing, and the repository will continue to change significantly while the application's underlying systems, game-data tools, interface, and player-facing features are built and tested.

Thanks for following the project as it develops!
