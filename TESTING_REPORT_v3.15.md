# Paradise Lawn Care v3.15 — Phase C Test Plan

## Added
- Home-screen “Today's Command Center” metrics.
- Route & Schedule Center inside the existing Schedule page.
- Today's route map and optimized stop order.
- Estimated drive miles, drive time, revenue, and finish time.
- Running-late communication preparation.
- Move incomplete jobs to tomorrow.

## Manual test
1. Open the app with an internet connection.
2. Add or use scheduled jobs for today with complete street, city, state, and ZIP addresses.
3. Open **Schedule** and click **Build Today's Route**.
4. Verify map markers, route line, stop order, mileage, travel time, revenue, and estimated finish.
5. Click **Prepare Running-Late Notices** and verify the Communication Center message.
6. Test **Move Incomplete to Tomorrow** using disposable/demo records.
7. Return Home and verify Command Center numbers update.

## External services
Geocoding uses OpenStreetMap Nominatim. Route calculations use the public OSRM routing service. Both require internet access and are suitable for testing. A production release should use a dedicated commercial or self-hosted routing service if usage grows.
