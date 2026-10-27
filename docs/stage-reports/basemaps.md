# More basemaps (27 October 2026)

John asked on 27 Oct 2026 for more Esri basemaps:
- Human Geography, light and dark;
- imagery at every scale;
- Terrain and Topographic, only where the data is lines and points;
- National Geographic and OpenStreetMap.

When asked, he confirmed that National Geographic and OpenStreetMap follow the same rule as Terrain and Topographic. Branch: `improve/basemaps` (from `main` after PR #24). Design: SH-08 and the 27 Oct amendment to ADR-0022. Sources: S25. Stage 9 has not been started.

## What was built

| Group | Styles | Source |
|---|---|---|
| Under any map | Dark grey, Light grey, **Human Geography**, **Human Geography dark**, Imagery (now at every scale) | Basemap styles service: `arcgis/dark-gray`, `arcgis/light-gray`, `arcgis/human-geography`, `arcgis/human-geography-dark`, `arcgis/imagery` |
| Lines and points only | **Terrain**, **Topographic**, **National Geographic**, **OpenStreetMap** | Styles service: `arcgis/terrain`, `arcgis/topographic`, `open/osm-style`. National Geographic: Esri's public "National Geographic Style Map" web map in ArcGIS Online |

- **Where the detailed styles are offered.** `selectMapShadesAreas` says whether the current view shades areas. Those views are:
  - the trade maps (Food Origins, Seasonal Supply, the Risk Explorer's supply view, Scenario A, commodity assessments);
  - the Risk Explorer's community view, and its farming regions when a measure is chosen;
  - UK Food Access councils below local scale, unless the council layer is off;
  - a deep profile's drawn small areas (Belfast and Manchester).

  Everywhere else the map draws only lines and points:
  - the logistics map;
  - Scenario B's closure circles and links, and Scenario D's ports;
  - Scenario C;
  - UK Food Access at local scale or with the council layer off;
  - profiles without small areas.

  There the four detailed styles are offered. Where the map shades areas, light grey stands in, the choice stays in the URL, and the control says why.
- **The control.** Two groups, five styles and "Lines and points only", with a note when the four are held back.
  - It fits the space below its button and scrolls.
  - It is nearly opaque, so it reads over the Seasonal timeline.
  - Labels and hints are separate words in each radio's accessible name.
- **Colour sets.** Each style has one, checked against its land and water colours as Esri publishes them (ADR-0022 amendment, S25):
  - **Human Geography:** the light set.
  - **Human Geography dark:** the dark set.
  - **Imagery:** the dark set with white outlines, as before.
  - **The detailed four:** the light set with four darker lines.

  Symbols over imagery and the detailed styles get a wider halo (`haloBoost`).
- **Captions and status.** Map images and PDFs name the basemap, for example "basemap Esri National Geographic Style". Insights' data status says where the basemap comes from (styles service with the key, or Esri's public web map with no key).

## Colours checked (27 Oct 2026)

| Style | Background colours used | Result |
|---|---|---|
| Human Geography | land `#f7f7f7`, sea white | Lowest share and risk classes 3.0:1 on the land, 3.2:1 on the sea |
| Human Geography dark | land `#222426`, sea `#26282a` | Lowest classes 3.0:1 (2.8:1 on the sea); symbols and lines ≥ 4.9:1 |
| Terrain, Topographic, National Geographic, OpenStreetMap | 18 land, water, urban, park and relief colours from the four styles (Terrain estimated), plus National Geographic's parks `#28ad1c` and darkest land tint `#72802d` | Navy ≥ 6.0:1 (4.1:1 on the tint). Selection `#1a237e` ≥ 5.2:1, proximity `#4a2a00` ≥ 5.1:1, primary roads `#00525e` ≥ 3.5:1, rail `#3949ab` ≥ 3.1:1 (3.0 and 2.6:1 on the bright parks; rail is dashed). In each view the colours drawn together differ by normal-vision ΔE ≥ 13.1 and CVD ΔE ≥ 9.8 |

The light set's mid-tone lines failed on the detailed styles: green selection 1.6:1 and slate primary roads 1.7:1 on National Geographic's parks. That is why those four lines are darker there.

## Commands run and results

To be filled in when the full end-to-end run on this branch finishes.

## Not verified, and why

- **The real styles.** The sandbox cannot reach Esri or ArcGIS Online, so the tests stub the styles service and the National Geographic web map. Each new style's look, attribution and requests on the live site join the live checks (B48, B75).
- **Terrain's colours.** Its relief is a raster, so its land and water were estimated, not read.
- **National Geographic's terms.** It comes from Esri's public ArcGIS Online content under the Esri Master License Agreement, not from the basemap styles service your key covers. Esri publishes "(for Developers)" items of Topographic and OpenStreetMap, but none of National Geographic (B74).

## Open questions for John

1. **National Geographic (B74).** Can you confirm that your ArcGIS account's terms cover showing Esri's public National Geographic Style Map on the site? If not, it can be removed in one line (`BASEMAP_SOURCES`).
2. **Light grey as the stand-in.** It replaces a detailed style where the map shades areas. Would you prefer Human Geography?
