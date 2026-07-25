# Paradise Lawn Care v3.14.1 Testing Report

## Weather dashboard and radar stability patch

### Changes
- Added a compact live weather card to the Home dashboard.
- Kept the full Weather tab for detailed forecasts, alerts, and radar.
- Corrected RainViewer radar tiles to respect the provider's maximum native zoom level of 7.
- Enabled Leaflet over-zooming so radar remains visible when viewing the local service area at street-level map zooms.
- Preloads radar frames and switches opacity instead of removing and recreating the layer every frame, reducing flashing.
- Slowed the animation slightly for easier viewing.

### Manual testing
1. Open the Home tab and confirm the Service Area Weather card loads Stuart conditions.
2. Press Open Radar.
3. Zoom in to Port St. Lucie, Stuart, Hobe Sound, Jupiter, and Palm Beach Gardens.
4. Confirm no “zoom level not supported” tiles appear.
5. Confirm precipitation remains visible when zoomed beyond radar zoom level 7.
6. Confirm radar animation changes frames without the map repeatedly flashing blank.
7. Test Play, Pause, Reset Map, and Refresh Weather.

Live weather and radar require an internet connection.
