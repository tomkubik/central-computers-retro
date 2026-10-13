# Central Computers — Norton Commander Retro TUI Catalog

A retro **Norton Commander (MS-DOS CP437 / VGA Text Mode)** tribute web application showcasing **Central Computers'** (`centralcomputer.com`) complete **AI Components** catalog.

Every product illustration, manufacturer logo, and power/bus connector icon is procedurally rendered in real time using an **`88 × 52` subpixel ANSI / CP437 block-tile engine (`█ ▀ ▄ ▓ ▒ ░`)** — **zero raster photos**.

---

## ✨ Features

- **Complete 239-Product AI Hardware Catalog across 15 Categories:**
  - **Core Components:** `CPUs` (27), `GPUs` (33), `RAM` (13), `Motherboards` (10), `SSDs` (21), `HDDs` (6), `CPU Coolers` (30), `PSUs` (15)
  - **Cases & Servers:** `Desktop Cases` (11), `Rackmount Cases` (6), `Server Barebones` (11)
  - **Peripherals & Turnkey AI:** `Accelerators` (2), `HPC Power Delivery` (3), `HBAs, NICs & NVLink` (36), `AI Supercomputers` (15)
- **100% Procedural High-Resolution ASCII / ANSI Hardware Art (`239/239` Unique Illustrations):**
  - Dual-attribute VGA character cells (`color` + `background`) with upper/lower half-block subpixels (`▀` / `▄`) and shaded tiles (`▓ ▒ ░`).
  - Dynamic per-product variance: blower vs. dual/triple-fan GPUs, rectangular SP5/sTR5 vs. notched AM5 CPU lids with core-scaled CCD die maps, 8-chip vs. 10-chip 3DS ECC RDIMMs, bare vs. heatsinked M.2 & U.2 NVMe SSDs, helium vs. silver HDD platters with sweeping actuator arms, 240/360mm Liquid AIOs vs. copper heatpipe towers, 1U/2U/4U/6U rackmount servers, optical transceivers, DAC cables, NVLink bridges, and DGX Spark (`GB10`) cube supercomputers.
  - High-contrast pixelated manufacturer badges (`NVIDIA`, `AMD`, `Intel`, `ASUS`, `PNY`, `MSI`, `GIGABYTE`, `ASRock`, `Micron`, `Samsung`, `SK Hynix`, `Solidigm`, `Seagate`, `Western Digital`, `SilverStone`, `Fractal`, `Noctua`, `Seasonic`, `APC`, `Tripp Lite`, `Lenovo`, etc.) and interface pinout diagrams (`12V-2x6 600W`, `LGA-6096 / sTR5`, `288-Pin DDR5`, `PCIe 5.0 / U.2`, `400G/800G QSFP`).
- **Two Interactive Views:**
  - **Product Browser View:** Dual-column Norton Commander catalog (`Category` + `Manufacturer & Product`) paired with a live hardware pixel-art stage and full technical specifications table.
  - **Rig Basket View:** Interactive workstation/server build list with miniature ANSI art thumbnails, quantity controls, **4 cycling AI Rig Presets (`F6`)**, and a **Bay Area Store Will-Call / Pickup Reservation Slip generator (`F9`)**.
- **Full Keyboard-First TUI Navigation:**
  - `Tab` / `Shift+Tab`: Cycle focus between **Top-most Menu** (`Product browser` | `Basket view`), **Main View** (`Category` | `Manufacturer & Product`), and **Bottom Function Bar** (`F1`–`F10`).
  - `←` / `→` & `↑` / `↓`: Navigate columns, categories, products, and menus (works seamlessly even while typing in the `F4` filter prompt).
  - `F1` (`1`): Help Modal
  - `F2` (`2`): Product Browser View
  - `F3` (`3` / `B`): Rig Basket View
  - `F4` (`4`): Live DOS Filter Search across all 239 products
  - `F5` (`5` / `Enter` / `Space`): Add to Basket
  - `F6` (`6`): Cycle through 4 curated AI Workstation & Server Rig Presets
  - `F7` (`7`): Cycle Display Palettes (Norton Commander Classic Blue, Amber Phosphor, P1 Green Monochrome — with Central Computers' signature `#00894a` green logo preserved across all modes)
  - `F8` (`8`): Clear Basket
  - `F9` (`9`): Toggle Bay Area Store Order / Reservation Slip
  - `F10` (`0`): Visit Official Central Computers Website (`https://www.centralcomputer.com/`)

---

## 🚀 Running Locally

No build step or external dependencies required. Serve the static files with any HTTP server:

```bash
python3 -m http.server 8090
```

Then open [`http://127.0.0.1:8090`](http://127.0.0.1:8090) in your browser.

---

## 📁 Project Structure

- `index.html` — Norton Commander TUI layout, huge `"C"` Central Computers banner, dual panes, Rig Basket modal, and `F1`–`F10` bar.
- `styles.css` — Classic VGA / CRT scanline styling, responsive container-query layout, and color themes.
- `catalog.js` — All 239 AI Components products with real SKUs, models, prices, and specifications from Central Computers.
- `pixelart.js` — `88 × 52` subpixel ANSI / CP437 procedural hardware & logo rendering engine.
- `app.js` — State management, 3-zone `Tab` & arrow-key navigation, live search filtering, and Rig Basket builder.
