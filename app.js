/* ==========================================================================
   APP.JS - CENTRAL COMPUTERS NORTON COMMANDER CONTROLLER (v4 - TAB ZONES)
   Tab key cycles between:
     1. Top-most Menu (Product Browser tab & Basket View tab, switchable from keyboard)
     2. Main View (Categories & Products)
     3. Bottom Pane (F1 Help, F2 Browser, F3 BasketVw, ..., F10 ExitBskt)
   ========================================================================== */

const state = {
  focusZone: 'main',       // 'top' | 'main' | 'bottom'
  topMenuIndex: 0,         // 0 = Product browser tab, 1 = Basket view tab
  bottomMenuIndex: 0,      // 0..9 corresponding to F1..F10 buttons in bottom pane
  catIndex: 1,             // Starts on GPUs (index 1: CPUs=0, GPUs=1) matching Slide 1!
  prodIndex: 0,            // Starts on RTX Pro 6000 Blackwell Max-Q 96GB GDDR7
  activeCol: 'categories', // 'categories' | 'products' (when focusZone === 'main')
  currentView: 'browser',  // 'browser' | 'basket'
  basketIndex: 0,          // Active item row index inside Basket View
  filterQuery: '',
  themeIndex: 0,
  themes: ['default', 'theme-amber', 'theme-green'],
  basket: [
    // Pre-populated with 3 items matching Slide 2 ("Rig basket" with 3 product rows)
    {
      product: CENTRAL_CATALOG[1].products[0], // RTX Pro 6000 Blackwell Max-Q 96GB GDDR7
      qty: 1
    },
    {
      product: CENTRAL_CATALOG[0].products[0], // AMD EPYC 9734 112-Core Processor
      qty: 1
    },
    {
      product: CENTRAL_CATALOG[3].products[0], // ASUS Pro WS W890E-SAGE SE Motherboard
      qty: 1
    }
  ]
};

// DOM References
const els = {
  tabbar: document.querySelector('.nc-tabbar'),
  fkeybar: document.querySelector('.nc-fkeybar'),
  fkeyBtns: Array.from(document.querySelectorAll('.fkey-btn')),
  categoryList: document.getElementById('categoryList'),
  productList: document.getElementById('productList'),
  hdrCategories: document.getElementById('hdrCategories'),
  hdrProducts: document.getElementById('hdrProducts'),
  prodCountHdr: document.getElementById('prodCountHdr'),
  activeColIndicator: document.getElementById('activeColIndicator'),
  pixelArtViewport: document.getElementById('pixelArtViewport'),
  pixelConnectorBadge: document.getElementById('pixelConnectorBadge'),
  inspectorMfgBadge: document.getElementById('inspectorMfgBadge'),
  inspectorPriceTag: document.getElementById('inspectorPriceTag'),
  specsProductTitle: document.getElementById('specsProductTitle'),
  specsTableBody: document.querySelector('#specsTable tbody'),
  selectedSkuStatus: document.getElementById('selectedSkuStatus'),
  catalogStatusText: document.getElementById('catalogStatusText'),
  dosBreadcrumb: document.getElementById('dosBreadcrumb'),
  dosPromptLabel: document.getElementById('dosPromptLabel'),
  dosCommandInput: document.getElementById('dosCommandInput'),
  workspace: document.getElementById('workspace'),
  basketOverlay: document.getElementById('basketOverlay'),
  basketItemsContainer: document.getElementById('basketItemsContainer'),
  basketSubtotalValue: document.getElementById('basketSubtotalValue'),
  basketCountBadge: document.getElementById('basketCountBadge'),
  basketHeaderTotal: document.getElementById('basketHeaderTotal'),
  basketCheckIcon: document.getElementById('basketCheckIcon'),
  headerBasketBtn: document.getElementById('headerBasketBtn'),
  tabBrowser: document.getElementById('tabBrowser'),
  tabBasket: document.getElementById('tabBasket'),
  addToBasketBtn: document.getElementById('addToBasketBtn'),
  closeBasketBtn: document.getElementById('closeBasketBtn'),
  returnToBrowserBtn: document.getElementById('returnToBrowserBtn'),
  loadSampleRigBtn: document.getElementById('loadSampleRigBtn'),
  clearBasketBtn: document.getElementById('clearBasketBtn'),
  checkoutBtn: document.getElementById('checkoutBtn'),
  pickupSlipBox: document.getElementById('pickupSlipBox'),
  crtToggleBtn: document.getElementById('crtToggleBtn'),
  crtOverlay: document.getElementById('crtOverlay'),
  dosClock: document.getElementById('dosClock'),
  helpOverlay: document.getElementById('helpOverlay'),
  closeHelpBtn: document.getElementById('closeHelpBtn'),
  fkey2: document.getElementById('fkey2'),
  fkey3: document.getElementById('fkey3'),
  fkey10Label: document.getElementById('fkey10Label')
};

function formatCurrency(val) {
  return '$' + Number(val).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function getCurrentCategory() {
  return CENTRAL_CATALOG[state.catIndex] || CENTRAL_CATALOG[0];
}

function getFilteredProducts() {
  const q = state.filterQuery.trim().toLowerCase();
  if (!q) {
    return getCurrentCategory().products;
  }
  const matches = [];
  CENTRAL_CATALOG.forEach(cat => {
    cat.products.forEach(prod => {
      const hay = `${prod.name} ${prod.manufacturer} ${prod.sku} ${prod.model || ''} ${cat.name}`.toLowerCase();
      if (hay.includes(q)) {
        matches.push(prod);
      }
    });
  });
  return matches;
}

function getCurrentProduct() {
  const prods = getFilteredProducts();
  if (prods.length === 0) return null;
  if (state.prodIndex >= prods.length) state.prodIndex = 0;
  return prods[state.prodIndex];
}

/* ==========================================================================
   UPDATE FOCUS VISUALS ACROSS THE 3 TAB ZONES:
   1) Top-most Menu ('top')
   2) Main View ('main': Categories | Products)
   3) Bottom Pane ('bottom': F1..F10 bar)
   ========================================================================== */
function updateFocusVisuals() {
  const isTop = state.focusZone === 'top';
  const isMain = state.focusZone === 'main';
  const isBottom = state.focusZone === 'bottom';

  // 1. Top-most Menu visuals
  els.tabbar.classList.toggle('active-zone', isTop);
  els.tabBrowser.classList.toggle('kb-focus', isTop && state.topMenuIndex === 0);
  els.tabBasket.classList.toggle('kb-focus', isTop && state.topMenuIndex === 1);
  els.headerBasketBtn.classList.toggle('kb-focus', isTop && state.topMenuIndex === 1);

  // 2. Main View column visuals
  const isCat = isMain && state.activeCol === 'categories';
  const isProd = isMain && state.activeCol === 'products';

  els.categoryList.classList.toggle('active-col', isCat);
  els.productList.classList.toggle('active-col', isProd);

  els.hdrCategories.classList.toggle('active-hdr', isCat);
  els.hdrProducts.classList.toggle('active-hdr', isProd);

  // 3. Bottom Pane (F1..F10) visuals
  els.fkeybar.classList.toggle('active-zone', isBottom);
  els.fkeyBtns.forEach((btn, idx) => {
    btn.classList.toggle('kb-focus', isBottom && idx === state.bottomMenuIndex);
  });

  // Top-right banner status badge showing current Tab Zone
  if (isTop) {
    const itemLbl = state.topMenuIndex === 0 ? 'PRODUCT BROWSER' : 'BASKET VIEW';
    els.activeColIndicator.textContent = `ZONE: [TOP MENU] ${itemLbl}`;
  } else if (isBottom) {
    const activeBtn = els.fkeyBtns[state.bottomMenuIndex];
    const lbl = activeBtn ? activeBtn.textContent.trim() : 'F-KEY';
    els.activeColIndicator.textContent = `ZONE: [BOTTOM PANE] ${lbl}`;
  } else if (state.currentView === 'basket') {
    els.activeColIndicator.textContent = `ZONE: [BASKET VIEW] ↑↓ SELECT | ←→/+/- QTY`;
  } else {
    const colLbl = state.activeCol === 'categories' ? '[COL 1] CATEGORY' : '[COL 2] PRODUCTS';
    els.activeColIndicator.textContent = `ZONE: [MAIN VIEW] ${colLbl}`;
  }
}

/* ==========================================================================
   RENDER TWO COLUMNS (Categories -> All Merged Products)
   ========================================================================== */
function renderCategories() {
  let html = '';
  CENTRAL_CATALOG.forEach((cat, idx) => {
    if (cat.group) {
      html += `<div class="cat-group-header">${cat.group}</div>`;
    }
    const isSelected = idx === state.catIndex;
    const totalProds = cat.products.length;
    html += `
      <div class="cat-item ${isSelected ? 'selected' : ''}" data-cat-idx="${idx}" role="option" aria-selected="${isSelected}">
        <span><span class="cat-arrow">❱</span>${cat.name}</span>
        <span class="item-count-pill">[${totalProds}]</span>
      </div>
    `;
  });
  els.categoryList.innerHTML = html;
}

function renderProducts() {
  const prods = getFilteredProducts();
  els.prodCountHdr.textContent = `(${prods.length})`;

  if (prods.length === 0) {
    els.productList.innerHTML = `
      <div style="padding:18px; color:var(--nc-text-yellow);">
        No products match filter "${state.filterQuery}". Press F10 or type 'clear' to reset.
      </div>
    `;
    return;
  }

  let html = '';
  prods.forEach((prod, idx) => {
    const isSelected = idx === state.prodIndex;
    html += `
      <div class="product-row ${isSelected ? 'selected' : ''}" data-prod-idx="${idx}" role="option" aria-selected="${isSelected}">
        ${renderMfgBadgeHTML(prod.manufacturer)}
        <div class="product-row-info">
          <div class="product-row-title">${prod.name}</div>
          <div class="product-row-meta">
            <span>SKU: ${prod.sku}${prod.model ? ' | Model: ' + prod.model : ''}</span>
            <span class="product-row-price">${formatCurrency(prod.price)}</span>
          </div>
        </div>
      </div>
    `;
  });
  els.productList.innerHTML = html;
}

/* ==========================================================================
   RENDER RIGHT PANE: HI-RES PIXEL ART + CONNECTOR TILE + SPECIFICATIONS TABLE
   ========================================================================== */
function renderInspector() {
  const prod = getCurrentProduct();
  if (!prod) return;

  els.inspectorMfgBadge.innerHTML = `[${prod.manufacturer}] // SKU: ${prod.sku}`;
  els.inspectorPriceTag.textContent = formatCurrency(prod.price);

  // Render High-Resolution Norton Commander Block/Shaded Tile Art (NO photos!)
  els.pixelArtViewport.innerHTML = renderPixelArtHTML(prod.artTemplate, prod.artVariant, prod);

  // Render Bottom-Right Connector Tile Art (Matches Slide 1 16-pin icon!)
  els.pixelConnectorBadge.innerHTML = renderConnectorHTML(prod.connector);

  // Render Specifications Table (Matches Slide 1 bottom-right table!)
  els.specsProductTitle.textContent = prod.name;
  els.specsTableBody.innerHTML = prod.specs.map(([k, v]) => `
    <tr>
      <td class="spec-key">${k}</td>
      <td class="spec-val">${v}</td>
    </tr>
  `).join('');

  // Update DOS Path & Status Footer
  const cat = getCurrentCategory();
  const dosPath = `C:\\CENTRAL\\AI_COMPONENTS\\${cat.id.toUpperCase()}>`;
  els.dosBreadcrumb.textContent = dosPath;
  els.dosPromptLabel.textContent = dosPath;
  els.selectedSkuStatus.textContent = `SKU: ${prod.sku} | ${formatCurrency(prod.price)}`;
  els.catalogStatusText.textContent = `TAB: Cycle Top/Main/Bottom | ←→ Move | ↑↓ Select | Enter Activate | F10 Central.com`;
}

/* ==========================================================================
   RENDER SLIDE 2: BASKET VIEW ("Rig basket")
   ========================================================================== */
function renderBasket() {
  const totalCount = state.basket.reduce((acc, item) => acc + item.qty, 0);
  const subtotal = state.basket.reduce((acc, item) => acc + item.product.price * item.qty, 0);

  els.basketCountBadge.textContent = `[${totalCount}]`;
  els.basketHeaderTotal.textContent = formatCurrency(subtotal);
  els.basketSubtotalValue.textContent = formatCurrency(subtotal);
  els.basketCheckIcon.textContent = state.currentView === 'basket' ? '☑' : '☐';
  els.headerBasketBtn.classList.toggle('active-basket', state.currentView === 'basket');

  if (state.basket.length === 0) {
    state.basketIndex = 0;
    els.basketItemsContainer.innerHTML = `
      <div style="text-align:center; padding:32px; color:var(--nc-text-cyan); border:2px dashed var(--nc-border-light);">
        RIG BASKET IS EMPTY.<br/>Press [F2] to return to the Product Browser, or click [F6 Load AI Workstation Preset].
      </div>
    `;
    return;
  }

  if (state.basketIndex >= state.basket.length) {
    state.basketIndex = state.basket.length - 1;
  }
  if (state.basketIndex < 0) {
    state.basketIndex = 0;
  }

  // Matches Slide 2 row layout: [ Product name box ] [ Mini Pixel Art + Connector ] [ Price box ] [Qty/Remove]
  els.basketItemsContainer.innerHTML = state.basket.map((item, idx) => {
    const p = item.product;
    const lineTotal = p.price * item.qty;
    const miniArt = renderPixelArtHTML(p.artTemplate, p.artVariant, p);
    const connObj = CONNECTOR_ART[p.connector] || CONNECTOR_ART['12v-2x6'];
    const isSelected = idx === state.basketIndex;

    return `
      <div class="basket-item-row ${isSelected ? 'selected' : ''}" data-row-idx="${idx}">
        <div class="basket-product-box">
          <div>${isSelected ? '❱ ' : ''}${p.name}</div>
          <div class="basket-product-sub">${p.manufacturer} | SKU: ${p.sku} | Unit: ${formatCurrency(p.price)} | Qty: ${item.qty}</div>
        </div>

        <div class="basket-art-thumb" title="High-Res Pixelated Block-Tile Thumbnail">
          <pre>${miniArt}</pre>
          <div class="basket-mini-conn" style="color:#55ffff">${connObj.grid.slice(0, 3).join('\n')}</div>
        </div>

        <div class="basket-price-box">
          ${formatCurrency(lineTotal)}
        </div>

        <div class="basket-row-actions">
          <button class="qty-btn" data-basket-action="dec" data-idx="${idx}" title="Decrease Qty (← or -)">-</button>
          <span class="basket-qty-display" title="Selected Quantity">${item.qty}x</span>
          <button class="qty-btn" data-basket-action="inc" data-idx="${idx}" title="Increase Qty (→ or +)">+</button>
          <button class="qty-btn" data-basket-action="del" data-idx="${idx}" title="Remove Item (Delete)" style="color:var(--nc-text-danger)">×</button>
        </div>
      </div>
    `;
  }).join('');
}

function setViewMode(mode) {
  state.currentView = mode;
  const isBasket = mode === 'basket';
  state.topMenuIndex = isBasket ? 1 : 0;

  els.tabBrowser.classList.toggle('active', !isBasket);
  els.tabBasket.classList.toggle('active', isBasket);
  els.fkey2.classList.toggle('active-fkey', !isBasket);
  els.fkey3.classList.toggle('active-fkey', isBasket);
  els.fkey10Label.textContent = 'Central.com';

  els.workspace.classList.toggle('basket-mode', isBasket);
  els.basketOverlay.classList.toggle('hidden', !isBasket);
  updateFocusVisuals();
  renderBasket();
}

function exitBasketOrStepBack() {
  // Safari-safe exit/back handler bound to F10 (never requires Escape!)
  if (!els.helpOverlay.classList.contains('hidden')) {
    els.helpOverlay.classList.add('hidden');
    return;
  }
  if (state.currentView === 'basket') {
    setViewMode('browser');
    return;
  }
  if (state.filterQuery) {
    state.filterQuery = '';
    els.dosCommandInput.value = '';
    renderAll();
    return;
  }
  state.focusZone = 'main';
  if (state.activeCol === 'products') {
    state.activeCol = 'categories';
  }
  renderAll();
}

let basketFlashTimer = null;

function triggerBasketPowerFlash() {
  [els.headerBasketBtn, els.tabBasket].forEach(el => {
    if (!el) return;
    el.classList.remove('tech-power-flash');
    void el.offsetWidth; // Force reflow so rapid additions re-trigger the surge
    el.classList.add('tech-power-flash');
  });

  if (els.basketCheckIcon) {
    els.basketCheckIcon.textContent = '⚡';
  }

  if (basketFlashTimer) clearTimeout(basketFlashTimer);
  basketFlashTimer = setTimeout(() => {
    [els.headerBasketBtn, els.tabBasket].forEach(el => {
      if (el) el.classList.remove('tech-power-flash');
    });
    if (els.basketCheckIcon) {
      els.basketCheckIcon.textContent = state.currentView === 'basket' ? '☑' : '☐';
    }
  }, 700);
}

function addCurrentProductToBasket() {
  const prod = getCurrentProduct();
  if (!prod) return;

  const existing = state.basket.find(item => item.product.id === prod.id);
  if (existing) {
    existing.qty += 1;
  } else {
    state.basket.push({ product: prod, qty: 1 });
  }

  renderBasket();
  triggerBasketPowerFlash();

  const origHTML = els.addToBasketBtn.innerHTML;
  els.addToBasketBtn.innerHTML = `<span class="btn-key">⚡</span> ADDED TO BASKET!`;
  setTimeout(() => {
    els.addToBasketBtn.innerHTML = origHTML;
  }, 850);
}

function renderAll() {
  renderCategories();
  renderProducts();
  updateFocusVisuals();
  renderInspector();
  renderBasket();
}

/* ==========================================================================
   EVENT LISTENERS & KEYBOARD NAVIGATION
   ========================================================================== */
[els.hdrCategories, els.hdrProducts].forEach(hdr => {
  hdr.addEventListener('click', () => {
    state.focusZone = 'main';
    state.activeCol = hdr.dataset.col;
    renderAll();
  });
});

els.categoryList.addEventListener('click', e => {
  const item = e.target.closest('.cat-item');
  state.focusZone = 'main';
  state.activeCol = 'categories';
  if (item) {
    state.catIndex = Number(item.dataset.catIdx);
    state.prodIndex = 0;
    state.filterQuery = '';
    els.dosCommandInput.value = '';
  }
  renderAll();
});

els.productList.addEventListener('click', e => {
  const row = e.target.closest('.product-row');
  state.focusZone = 'main';
  state.activeCol = 'products';
  if (row) {
    state.prodIndex = Number(row.dataset.prodIdx);
  }
  renderAll();
});

els.productList.addEventListener('dblclick', e => {
  if (e.target.closest('.product-row')) {
    addCurrentProductToBasket();
  }
});

els.addToBasketBtn.addEventListener('click', addCurrentProductToBasket);

els.tabBrowser.addEventListener('click', () => {
  state.focusZone = 'main';
  state.topMenuIndex = 0;
  setViewMode('browser');
});
els.tabBasket.addEventListener('click', () => {
  state.focusZone = 'main';
  state.topMenuIndex = 1;
  setViewMode('basket');
});
els.headerBasketBtn.addEventListener('click', () => {
  setViewMode(state.currentView === 'basket' ? 'browser' : 'basket');
});
els.closeBasketBtn.addEventListener('click', () => setViewMode('browser'));
els.returnToBrowserBtn.addEventListener('click', () => setViewMode('browser'));

els.basketItemsContainer.addEventListener('click', e => {
  const row = e.target.closest('.basket-item-row');
  const btn = e.target.closest('.qty-btn');

  if (row && !btn) {
    state.focusZone = 'main';
    state.basketIndex = Number(row.dataset.rowIdx);
    updateFocusVisuals();
    renderBasket();
    return;
  }

  if (!btn) return;
  const idx = Number(btn.dataset.idx);
  const action = btn.dataset.basketAction;
  if (!state.basket[idx]) return;

  state.focusZone = 'main';
  state.basketIndex = idx;

  if (action === 'inc') {
    state.basket[idx].qty += 1;
    triggerBasketPowerFlash();
  } else if (action === 'dec') {
    state.basket[idx].qty -= 1;
    if (state.basket[idx].qty <= 0) state.basket.splice(idx, 1);
  } else if (action === 'del') {
    state.basket.splice(idx, 1);
  }
  hideOrderSlip();
  updateFocusVisuals();
  renderBasket();
});

const RIG_PRESETS = [
  {
    name: 'PRESET 1/4: DUAL RTX PRO 6000 BLACKWELL WORKSTATION',
    items: () => [
      { product: CENTRAL_CATALOG[1].products[0], qty: 2 }, // 2x PNY NVIDIA RTX Pro 6000 Blackwell Max-Q 96GB
      { product: CENTRAL_CATALOG[0].products[0], qty: 1 }, // AMD EPYC 9734 112-Core Processor
      { product: CENTRAL_CATALOG[3].products[0], qty: 1 }, // ASUS Pro WS W890E-SAGE SE Motherboard
      { product: CENTRAL_CATALOG[2].products[3], qty: 4 }, // 4x DDR5 ECC RDIMM Memory
      { product: CENTRAL_CATALOG[4].products[3], qty: 2 }, // 2x Gen5 Enterprise NVMe SSD
      { product: CENTRAL_CATALOG[7].products[1], qty: 1 }  // High-Wattage Workstation PSU
    ]
  },
  {
    name: 'PRESET 2/4: RADEON AI PRO R9700 CREATOR RIG',
    items: () => [
      { product: CENTRAL_CATALOG[1].products[1], qty: 2 }, // 2x ASRock AMD Radeon AI PRO R9700 Creator 32GB
      { product: CENTRAL_CATALOG[0].products[2], qty: 1 }, // Workstation Processor
      { product: CENTRAL_CATALOG[3].products[1], qty: 1 }, // Workstation Motherboard
      { product: CENTRAL_CATALOG[2].products[0], qty: 4 }, // 4x Hynix 32GB DDR5-8000 ECC RDIMM
      { product: CENTRAL_CATALOG[4].products[0], qty: 2 }, // 2x Solidigm D7-P5520 3.84TB U.2 NVMe
      { product: CENTRAL_CATALOG[8].products[0], qty: 1 }  // Silverstone ALTA T2 Super Tower
    ]
  },
  {
    name: 'PRESET 3/4: 4U ENTERPRISE RACKMOUNT AI CLUSTER NODE',
    items: () => [
      { product: CENTRAL_CATALOG[10].products[0], qty: 1 }, // ASUS ESC8000A-E13P 4U AMD Server Barebone
      { product: CENTRAL_CATALOG[0].products[0], qty: 2 },  // 2x AMD EPYC 9734 112-Core SP5
      { product: CENTRAL_CATALOG[1].products[0], qty: 4 },  // 4x NVIDIA RTX Pro 6000 Blackwell Max-Q 96GB
      { product: CENTRAL_CATALOG[2].products[2], qty: 8 },  // 8x DDR5 Server Memory
      { product: CENTRAL_CATALOG[13].products[0], qty: 2 }, // 2x 100G QSFP28 Optical Transceiver
      { product: CENTRAL_CATALOG[12].products[0], qty: 1 }  // APC NetShelter Switched Rack PDU
    ]
  },
  {
    name: 'PRESET 4/4: COMPACT DGX SPARK AI SUPERCOMPUTER DESK',
    items: () => [
      { product: CENTRAL_CATALOG[14].products[0], qty: 1 }, // ASUS Ascent GX10 AI Supercomputer (GB10)
      { product: CENTRAL_CATALOG[11].products[0], qty: 1 }, // ASUS UGen300 USB AI Accelerator Hailo-10H
      { product: CENTRAL_CATALOG[4].products[1], qty: 2 },  // 2x Enterprise NVMe Storage
      { product: CENTRAL_CATALOG[13].products[1], qty: 1 }  // High-Speed Networking Adapter
    ]
  }
];

let currentPresetIdx = -1;

function loadNextPresetRig() {
  currentPresetIdx = (currentPresetIdx + 1) % RIG_PRESETS.length;
  const preset = RIG_PRESETS[currentPresetIdx];
  state.basket = preset.items().filter(i => i.product);
  state.basketIndex = 0;
  state.focusZone = 'main';
  hideOrderSlip();

  const titleEl = document.getElementById('rigBasketTitle');
  if (titleEl) {
    titleEl.textContent = `Rig basket — [${preset.name}]`;
  }
  els.loadSampleRigBtn.textContent = `[F6] Next Preset (${currentPresetIdx + 1}/${RIG_PRESETS.length})`;

  setViewMode('basket');
  renderBasket();
  if (els.basketItemsContainer) {
    els.basketItemsContainer.scrollTop = 0;
  }
}

function hideOrderSlip() {
  els.pickupSlipBox.classList.add('hidden');
  els.checkoutBtn.textContent = '[F9] GENERATE BAY AREA STORE PICKUP SLIP';
}

function toggleOrderSlip() {
  const isAlreadyShowingInBasket =
    state.currentView === 'basket' && !els.pickupSlipBox.classList.contains('hidden');

  if (isAlreadyShowingInBasket) {
    hideOrderSlip();
    return;
  }

  setViewMode('basket');
  if (state.basket.length === 0) return;
  const subtotal = state.basket.reduce((acc, item) => acc + item.product.price * item.qty, 0);
  const orderId = 'CC-' + Math.floor(100000 + Math.random() * 900000);
  const lines = state.basket.map(i => `  * ${i.qty}x [${i.product.sku}] ${i.product.name} — ${formatCurrency(i.product.price * i.qty)}`).join('\n');

  els.pickupSlipBox.textContent =
`╔══════════════════════════════════════════════════════════════════════════╗
║ CENTRAL COMPUTERS - WILL CALL / CUSTOM RIG RESERVATION SLIP              ║
║ Order Ref: ${orderId}   |   Store: 3777 Stevens Creek Blvd, Santa Clara ║
╚══════════════════════════════════════════════════════════════════════════╝
${lines}
----------------------------------------------------------------------------
ESTIMATED RIG SUBTOTAL: ${formatCurrency(subtotal)}  (Status: READY FOR TUI VERIFICATION)`;
  els.pickupSlipBox.classList.remove('hidden');
  els.checkoutBtn.textContent = '[F9] HIDE BAY AREA STORE PICKUP SLIP';
}

els.loadSampleRigBtn.addEventListener('click', () => {
  loadNextPresetRig();
});

els.clearBasketBtn.addEventListener('click', () => {
  state.basket = [];
  hideOrderSlip();
  const titleEl = document.getElementById('rigBasketTitle');
  if (titleEl) titleEl.textContent = 'Rig basket';
  renderBasket();
});

els.checkoutBtn.addEventListener('click', () => {
  toggleOrderSlip();
});

// CRT Toggle & Theme Palette Cycling
els.crtToggleBtn.addEventListener('click', () => {
  const isOff = els.crtOverlay.classList.toggle('off');
  els.crtToggleBtn.textContent = isOff ? '[CRT: OFF]' : '[CRT: ON]';
});

function cyclePalette() {
  state.themeIndex = (state.themeIndex + 1) % state.themes.length;
  document.body.classList.remove('theme-amber', 'theme-green');
  const nextTheme = state.themes[state.themeIndex];
  if (nextTheme !== 'default') {
    document.body.classList.add(nextTheme);
  }
}

// Function Key Bar Clicks
els.fkeyBtns.forEach((btn, idx) => {
  btn.addEventListener('click', () => {
    state.bottomMenuIndex = idx;
    const action = btn.getAttribute('data-action');
    handleAction(action);
    updateFocusVisuals();
  });
});

function handleAction(action) {
  switch (action) {
    case 'help':
      els.helpOverlay.classList.toggle('hidden');
      break;
    case 'view-browser':
      state.focusZone = 'main';
      if (state.currentView !== 'browser') {
        setViewMode('browser');
      } else {
        state.activeCol = state.activeCol === 'categories' ? 'products' : 'categories';
        renderAll();
      }
      break;
    case 'view-basket':
      setViewMode(state.currentView === 'basket' ? 'browser' : 'basket');
      break;
    case 'focus-search':
      setViewMode('browser');
      state.focusZone = 'main';
      state.activeCol = 'products';
      renderAll();
      els.dosCommandInput.focus();
      break;
    case 'add-item':
      addCurrentProductToBasket();
      break;
    case 'preset-rig':
      loadNextPresetRig();
      break;
    case 'cycle-palette':
      cyclePalette();
      break;
    case 'clear-rig':
      state.basket = [];
      hideOrderSlip();
      const titleEl = document.getElementById('rigBasketTitle');
      if (titleEl) titleEl.textContent = 'Rig basket';
      renderBasket();
      break;
    case 'pickup-slip':
      toggleOrderSlip();
      break;
    case 'exit-back':
      window.location.href = 'https://www.centralcomputer.com/';
      break;
  }
}

els.closeHelpBtn.addEventListener('click', () => {
  els.helpOverlay.classList.add('hidden');
});

// DOS Command Line Input (Filter View)
els.dosCommandInput.addEventListener('focus', () => {
  state.focusZone = 'main';
  state.activeCol = 'products';
  updateFocusVisuals();
});

els.dosCommandInput.addEventListener('input', e => {
  const val = e.target.value.trim();
  if (val.toLowerCase().startsWith('search ')) {
    state.filterQuery = val.slice(7);
  } else if (!['basket', 'clear', 'help', 'cls'].includes(val.toLowerCase())) {
    state.filterQuery = val;
  }
  state.prodIndex = 0;
  state.focusZone = 'main';
  state.activeCol = 'products';
  renderAll();
});

els.dosCommandInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const cmd = els.dosCommandInput.value.trim().toLowerCase();
    if (cmd === 'basket') {
      setViewMode('basket');
      els.dosCommandInput.value = '';
    } else if (cmd === 'clear' || cmd === 'cls') {
      state.filterQuery = '';
      els.dosCommandInput.value = '';
      renderAll();
    } else if (cmd === 'help') {
      els.helpOverlay.classList.remove('hidden');
      els.dosCommandInput.value = '';
    } else {
      state.focusZone = 'main';
      els.dosCommandInput.blur();
      updateFocusVisuals();
    }
  }
});

// Navigate across the Main Product View Pane (Categories & Products)
function navigateMainProductPane(key) {
  state.focusZone = 'main';
  if (key === 'ArrowRight') {
    state.activeCol = 'products';
    renderAll();
    scrollSelectedIntoView();
    return true;
  }
  if (key === 'ArrowLeft') {
    state.activeCol = 'categories';
    renderAll();
    scrollSelectedIntoView();
    return true;
  }
  if (key === 'ArrowDown') {
    if (state.activeCol === 'categories') {
      state.catIndex = (state.catIndex + 1) % CENTRAL_CATALOG.length;
      state.prodIndex = 0;
      if (state.filterQuery) {
        state.filterQuery = '';
        els.dosCommandInput.value = '';
      }
    } else {
      const prods = getFilteredProducts();
      if (prods.length > 0) state.prodIndex = (state.prodIndex + 1) % prods.length;
    }
    renderAll();
    scrollSelectedIntoView();
    return true;
  }
  if (key === 'ArrowUp') {
    if (state.activeCol === 'categories') {
      state.catIndex = (state.catIndex - 1 + CENTRAL_CATALOG.length) % CENTRAL_CATALOG.length;
      state.prodIndex = 0;
      if (state.filterQuery) {
        state.filterQuery = '';
        els.dosCommandInput.value = '';
      }
    } else {
      const prods = getFilteredProducts();
      if (prods.length > 0) state.prodIndex = (state.prodIndex - 1 + prods.length) % prods.length;
    }
    renderAll();
    scrollSelectedIntoView();
    return true;
  }
  return false;
}

/* ==========================================================================
   GLOBAL KEYBOARD NAVIGATION
   TAB cycles between:
     'top' (Top-most menu: Product Browser & Basket View) ->
     'main' (Main view: Categories & Products) ->
     'bottom' (Bottom pane: Help, Browser, BasketVw, etc.)
   ========================================================================== */
window.addEventListener('keydown', e => {
  // Function Keys F1..F10 always work globally (even when filter input is focused!)
  if (e.key === 'F1') { e.preventDefault(); els.dosCommandInput.blur(); handleAction('help'); return; }
  if (e.key === 'F2') { e.preventDefault(); els.dosCommandInput.blur(); handleAction('view-browser'); return; }
  if (e.key === 'F3') { e.preventDefault(); els.dosCommandInput.blur(); handleAction('view-basket'); return; }
  if (e.key === 'F4') { e.preventDefault(); handleAction('focus-search'); return; }
  if (e.key === 'F5') { e.preventDefault(); handleAction('add-item'); return; }
  if (e.key === 'F6') { e.preventDefault(); els.dosCommandInput.blur(); handleAction('preset-rig'); return; }
  if (e.key === 'F7') { e.preventDefault(); handleAction('cycle-palette'); return; }
  if (e.key === 'F8') { e.preventDefault(); handleAction('clear-rig'); return; }
  if (e.key === 'F9') { e.preventDefault(); els.dosCommandInput.blur(); handleAction('pickup-slip'); return; }
  if (e.key === 'F10') {
    e.preventDefault();
    handleAction('exit-back');
    return;
  }

  // While in Filter input (F4 Filter / DOS prompt), allow Arrow keys to navigate
  // directly across the Product View pane (Categories & Products columns)!
  if (document.activeElement === els.dosCommandInput) {
    if (e.key === 'Tab') {
      e.preventDefault();
      els.dosCommandInput.blur();
      state.focusZone = 'bottom';
      updateFocusVisuals();
      return;
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      navigateMainProductPane(e.key);
      return;
    }
    return;
  }

  // TAB / SHIFT+TAB cycles across Top-most Menu -> Main View -> Bottom Pane
  if (e.key === 'Tab') {
    e.preventDefault();
    const zones = ['top', 'main', 'bottom'];
    const curIdx = zones.indexOf(state.focusZone);
    const dir = e.shiftKey ? -1 : 1;
    state.focusZone = zones[(curIdx + dir + zones.length) % zones.length];
    updateFocusVisuals();
    return;
  }

  // Number Shortcuts 1..0 when not typing in Filter input
  if (e.key === '1') { e.preventDefault(); handleAction('help'); return; }
  if (e.key === '2') { e.preventDefault(); handleAction('view-browser'); return; }
  if (e.key === '3') { e.preventDefault(); handleAction('view-basket'); return; }
  if (e.key === '4') { e.preventDefault(); handleAction('focus-search'); return; }
  if (e.key === '5') { e.preventDefault(); handleAction('add-item'); return; }
  if (e.key === '6') { e.preventDefault(); handleAction('preset-rig'); return; }
  if (e.key === '7') { e.preventDefault(); handleAction('cycle-palette'); return; }
  if (e.key === '8') { e.preventDefault(); handleAction('clear-rig'); return; }
  if (e.key === '9') { e.preventDefault(); handleAction('pickup-slip'); return; }
  if (e.key === '0') {
    e.preventDefault();
    handleAction('exit-back');
    return;
  }
  if (e.key === 'Backspace') {
    e.preventDefault();
    exitBasketOrStepBack();
    return;
  }

  if (e.key === 'b' || e.key === 'B') {
    e.preventDefault();
    setViewMode(state.currentView === 'basket' ? 'browser' : 'basket');
    return;
  }

  // ZONE 1: TOP-MOST MENU (Product Browser & Basket View, switchable from keyboard!)
  if (state.focusZone === 'top') {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      state.topMenuIndex = state.topMenuIndex === 0 ? 1 : 0;
      setViewMode(state.topMenuIndex === 0 ? 'browser' : 'basket');
      return;
    }
    if (e.key === 'ArrowDown') {
      // Pressing Down from Top Menu drops straight into Main View pane (Browser or Basket)
      e.preventDefault();
      state.focusZone = 'main';
      updateFocusVisuals();
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setViewMode(state.topMenuIndex === 0 ? 'browser' : 'basket');
      return;
    }
    return;
  }

  // ZONE 3: BOTTOM PANE (Help, Browser, BasketVw, Filter, Add to Basket, Preset, Palette, Clear Basket, OrderSlp, Central.com)
  if (state.focusZone === 'bottom') {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      state.bottomMenuIndex = (state.bottomMenuIndex + 1) % els.fkeyBtns.length;
      updateFocusVisuals();
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      state.bottomMenuIndex = (state.bottomMenuIndex - 1 + els.fkeyBtns.length) % els.fkeyBtns.length;
      updateFocusVisuals();
      return;
    }
    if (e.key === 'ArrowUp') {
      // Pressing Up from Bottom Pane jumps back into Main View pane (Browser or Basket)
      e.preventDefault();
      state.focusZone = 'main';
      updateFocusVisuals();
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const btn = els.fkeyBtns[state.bottomMenuIndex];
      if (btn) {
        handleAction(btn.getAttribute('data-action'));
        updateFocusVisuals();
      }
      return;
    }
    return;
  }

  // ZONE 2: MAIN VIEW — BASKET NAVIGATION & QUANTITY ADJUSTMENT
  if (state.currentView === 'basket') {
    if (state.basket.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      state.basketIndex = (state.basketIndex + 1) % state.basket.length;
      renderBasket();
      scrollBasketSelectedIntoView();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      state.basketIndex = (state.basketIndex - 1 + state.basket.length) % state.basket.length;
      renderBasket();
      scrollBasketSelectedIntoView();
      return;
    }
    if (e.key === 'ArrowRight' || e.key === '+' || e.key === '=') {
      e.preventDefault();
      if (state.basket[state.basketIndex]) {
        state.basket[state.basketIndex].qty += 1;
        hideOrderSlip();
        renderBasket();
        triggerBasketPowerFlash();
        scrollBasketSelectedIntoView();
      }
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === '-' || e.key === '_') {
      e.preventDefault();
      if (state.basket[state.basketIndex]) {
        state.basket[state.basketIndex].qty -= 1;
        if (state.basket[state.basketIndex].qty <= 0) {
          state.basket.splice(state.basketIndex, 1);
        }
        hideOrderSlip();
        renderBasket();
        scrollBasketSelectedIntoView();
      }
      return;
    }
    if (e.key === 'Delete') {
      e.preventDefault();
      if (state.basket[state.basketIndex]) {
        state.basket.splice(state.basketIndex, 1);
        hideOrderSlip();
        renderBasket();
        scrollBasketSelectedIntoView();
      }
      return;
    }
    return;
  }

  // ZONE 2: MAIN VIEW — PRODUCT BROWSER (Categories & Products)
  if (navigateMainProductPane(e.key)) {
    e.preventDefault();
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    if (state.activeCol === 'categories') {
      state.activeCol = 'products';
      renderAll();
    } else {
      addCurrentProductToBasket();
    }
  }
});

function scrollBasketSelectedIntoView() {
  if (!els.basketItemsContainer) return;
  const sel = els.basketItemsContainer.querySelector('.basket-item-row.selected');
  if (sel) sel.scrollIntoView({ block: 'nearest' });
}

function scrollSelectedIntoView() {
  const container = state.activeCol === 'categories' ? els.categoryList : els.productList;
  const sel = container.querySelector('.selected');
  if (sel) sel.scrollIntoView({ block: 'nearest' });
}

// Live DOS Clock
function updateClock() {
  const now = new Date();
  els.dosClock.textContent = now.toTimeString().slice(0, 8);
}
setInterval(updateClock, 1000);
updateClock();

// Initial Render
renderAll();
