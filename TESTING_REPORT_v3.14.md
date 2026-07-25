# Paradise Lawn Care Operations Suite v3.14

## Phase B — Weather Command Center

### Added
- Dedicated Weather tab.
- Live National Weather Service forecast and current conditions.
- Animated RainViewer radar.
- Radar centered on St. Lucie County, Martin County, and northern Palm Beach County.
- Quick forecast buttons for Fort Pierce, Port St. Lucie, Stuart, Hobe Sound, Jupiter, and Palm Beach Gardens.
- Active-alert filtering for the three-county service territory.
- Play/pause radar animation, map reset, zoom, and pan.
- Responsive desktop and mobile layout.

### Automated validation
- JavaScript syntax check: PASSED (`node --check script.js`).
- Existing automated browser tests could not be completed in this build environment because the test-only npm dependencies were unavailable. No production dependency is required for the app itself.

### Manual test checklist
1. Open `index.html` through Visual Studio Code Live Server.
2. Open the Weather tab.
3. Confirm the basemap and animated radar load.
4. Press Pause and Play; verify the radar timestamp changes while playing.
5. Zoom and drag the map, then press Reset Map.
6. Select each service-area city and confirm the forecast updates.
7. Press Refresh Weather.
8. Disconnect the internet temporarily and confirm a readable connection warning appears.
9. Recheck Quotes, Communication Center, Customers, Invoices, Scheduling, Maintenance, and Alerts.

### Internet requirement
The live forecast, alerts, map tiles, and radar require an active internet connection. Saved Paradise Lawn Care records continue to remain local.
