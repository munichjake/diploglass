# Changelog

All notable changes to DiploGlass will be documented in this file.

## [1.1.0] - 2026-04-08

### Added
- **Foundry VTT v14 Kompatibilität** - Vollständige Unterstützung für Foundry VTT v14 (verifiziert bis v14.359)
- **Export von Fraktionen** ([#3](https://github.com/munichjake/diploglass/issues/3)) - Fraktions-Strukturen (ohne Fortschritt) als JSON exportieren, ideal für West Marches Kampagnen
- **Drag & Drop Sortierung** - Fraktionen in der Seitenleiste per Drag & Drop umsortieren (nur GM)
- **Savras Telemetry** - Anonyme, opt-out Nutzungsstatistiken zur Feature-Analyse (keine persönlichen Daten)

### Fixed
- **Fraktionen löschen** ([#1](https://github.com/munichjake/diploglass/issues/1)) - Delete-Button ist jetzt deutlich sichtbar mit erhöhter Opazität und Textlabel
- **Delete-Bestätigungsdialog** - Sicherheitsabfrage vor dem Löschen war bereits implementiert (verifiziert und bestätigt)
- **Logik-Bug in deleteFaction()** - Beim Löschen einer Fraktion werden jetzt immer beide Datenquellen (Per-Player und Global) bereinigt, um Datenleichen zu vermeiden
- **Chat-Nachrichten bei Custom Steps** - Chat-Messages werden jetzt auch für Fraktionen mit nicht-standardmäßiger Stufenanzahl korrekt gesendet
- **Fraktion zurücksetzen im Per-Player-Modus** - Reset setzt jetzt alle Spieler-Reputationen zurück, nicht nur den globalen Wert
- **XSS-Absicherung** - Nutzereingaben und Entity-Namen werden jetzt korrekt escaped

### Improved
- Code-Cleanup und Modularisierung: Duplizierter Code extrahiert, Utility-Module eingeführt
- Bessere Fehlerbehandlung und Input-Validierung in der gesamten Codebase
- Ungenutztes Template und toten Code entfernt

## [1.0.0] - 2026-01-18

### Added
- Faction management with custom icons, linked journal entries, and configurable reputation scales
- Flexible reputation tracking with per-player or global (group) modes
- Customizable reputation levels (3-21 steps) with custom labels and colors
- RollTable integration for dynamic status descriptions
- Change log for tracking reputation modifications
- Chat message integration with visibility options (GM only, all players, players only)
- Player access control settings (hidden, view only, view and edit)
- Token controls and player list integration
- 13 language translations: German, English, French, Italian, Spanish, Japanese, Korean, Turkish, Polish, Hungarian, Danish, Swedish, Finnish
- Foundry VTT v12 and v13 compatibility
