const CATEGORIES = [
  'All Notes',
  'Plot Hooks & Quests',
  'NPCs & Factions',
  'Locations & Worldbuilding',
  'Random Encounters',
  'Session Recaps & Archives',
  'Rules & Mechanics'
];

let sessionState = {
  role: 'landing',
  partyCode: '',
  playerName: '',
  data: {
    activeCategory: 'All Notes',
    activeNoteId: 'note-welcome',
    characters: [],
    notes: [
      {
        id: 'note-welcome',
        title: 'Welcome to Your Campaign',
        category: 'Rules & Mechanics',
        tags: '#start',
        content: 'Manage your party codes, characters, and campaign notes from this elite command center.'
      }
    ]
  }
};

function saveCurrentParty() {
  if (!sessionState.partyCode) return;
  localStorage.setItem('ORRAN_PARTY_' + sessionState.partyCode, JSON.stringify(sessionState.data));
}

function loadParty(code) {
  const raw = localStorage.getItem('ORRAN_PARTY_' + code);
  if (!raw) return false;
  try {
    sessionState.data = JSON.parse(raw);
    sessionState.partyCode = code;
    return true;
  } catch (e) {
    return false;
  }
}

function hostNewParty() {
  const code = 'ORR-' + Math.floor(1000 + Math.random() * 9000);
  sessionState.partyCode = code;
  sessionState.role = 'dm';
  saveCurrentParty();
  switchView('dm');
  initDmApp();
}

function joinPartyAsPlayer() {
  const code = document.getElementById('joinCodeInput').value.trim().toUpperCase();
  const name = document.getElementById('joinNameInput').value.trim();
  if (!code || !name) {
    alert('Please enter both a Party Code and your Character Name.');
    return;
  }
  if (!loadParty(code)) {
    alert('Party code not found! Make sure the DM has created the party.');
    return;
  }
  sessionState.partyCode = code;
  sessionState.playerName = name;
  sessionState.role = 'player';

  let char = sessionState.data.characters.find(c => c.name.toLowerCase() === name.toLowerCase());
  if (!char) {
    char = {
      id: 'char-' + Date.now(),
      name: name,
      type: 'PC',
      race: 'Human',
      className: 'Adventurer',
      level: 1,
      armor: 'None',
      stats: { STR: 12, DEX: 12, CON: 12, INT: 10, WIS: 10, CHA: 10, LCK: 10 },
      hp: 100, maxHp: 100,
      mp: 20, maxMp: 20,
      sp: 80, maxSp: 80,
      gold: 50,
      inventory: [{ name: 'Adventurer Pack', qty: 1, type: 'Misc' }],
      auditLog: [`[Joined] Connected to party session.`]
    };
    sessionState.data.characters.push(char);
    saveCurrentParty();
  }

  switchView('player');
  initPlayerApp();
}

function switchView(viewName) {
  document.querySelectorAll('.view-screen').forEach(el => el.classList.remove('active'));
  if (viewName === 'landing') {
    document.getElementById('view-landing').classList.add('active');
    sessionState.role = 'landing';
  } else if (viewName === 'dm') {
    document.getElementById('view-dm').classList.add('active');
    document.getElementById('dmPartyCodeDisplay').textContent = `Party: ${sessionState.partyCode}`;
    initDmApp();
  } else if (viewName === 'player') {
    document.getElementById('view-player').classList.add('active');
    document.getElementById('playerPartyCodeDisplay').textContent = `Party: ${sessionState.partyCode} | Player: ${sessionState.playerName}`;
    initPlayerApp();
  }
}

function calcMod(score) {
  return Math.floor((Number(score) - 10) / 2);
}

function formatMod(score) {
  const m = calcMod(score);
  return m >= 0 ? `+${m}` : `${m}`;
}

// DM APP LOGIC
function initDmApp() {
  renderDmCharacters();
  renderCategoryTabs();
  renderNotesList();
  if (sessionState.data.activeNoteId && sessionState.data.notes.some(n => n.id === sessionState.data.activeNoteId)) {
    selectNote(sessionState.data.activeNoteId);
  } else if (sessionState.data.notes.length > 0) {
    selectNote(sessionState.data.notes[0].id);
  }
}

function renderDmCharacters() {
  const list = document.getElementById('dmCharList');
  const filter = document.getElementById('rosterFilter').value;
  list.innerHTML = '';

  const chars = sessionState.data.characters.filter(c => filter === 'ALL' || c.type === filter);
  if (chars.length === 0) {
    list.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:40px; font-style:italic;">No characters in roster yet. Click "+ Add Character" above.</div>`;
    return;
  }

  chars.forEach(c => {
    const hpPct = Math.max(0, Math.min(100, Math.round((c.hp / Math.max(1, c.maxHp)) * 100)));
    const mpPct = Math.max(0, Math.min(100, Math.round((c.mp / Math.max(1, c.maxMp)) * 100)));
    const spPct = Math.max(0, Math.min(100, Math.round((c.sp / Math.max(1, c.maxSp)) * 100)));

    const card = document.createElement('div');
    card.className = `char-card ${c.type === 'NPC' ? 'npc-card' : 'pc-card'}`;
    card.innerHTML = `
      <div class="char-top">
        <div>
          <div class="char-title">
            <span>${escapeHtml(c.name)}</span>
            <span class="badge">${c.type}</span>
            <span class="badge">Lv.${c.level} ${escapeHtml(c.race || '')} ${escapeHtml(c.className || '')}</span>
          </div>
          <div style="font-size:11px; color:var(--text-muted); margin-top:3px;">🛡️ ${escapeHtml(c.armor || 'No Armor')}</div>
        </div>
        <div style="display:flex; gap:5px;">
          <button onclick="levelUpChar('${c.id}')" title="Level Up">🆙 Lv+</button>
          <button onclick="openCharacterModal('${c.id}')" title="Edit">⚙️</button>
          <button class="btn-danger" onclick="deleteCharacter('${c.id}')" title="Remove">✕</button>
        </div>
      </div>

      <div class="stats-grid">
        ${['STR','DEX','CON','INT','WIS','CHA','LCK'].map(st => `
          <div class="stat-cell">
            <span>${st}</span>
            <strong>${c.stats[st]} (${formatMod(c.stats[st])})</strong>
          </div>
        `).join('')}
      </div>

      <!-- HP -->
      <div class="res-row">
        <span class="res-label" style="color:#fca5a5;">HP</span>
        <div class="bar-wrap">
          <div class="bar-fill bar-hp" style="width:${hpPct}%"></div>
          <div class="bar-text">${c.hp} / ${c.maxHp}</div>
        </div>
        <div class="res-btns">
          <button class="btn-hp" onclick="adjustPool('${c.id}','hp',-10)">-10</button>
          <input type="number" id="delta-hp-${c.id}" value="10">
          <button class="btn-hp" onclick="adjustPoolCustom('${c.id}','hp',-1)">-</button>
          <button class="btn-sp" onclick="adjustPoolCustom('${c.id}','hp',1)">+</button>
          <button class="btn-sp" onclick="adjustPool('${c.id}','hp',10)">+10</button>
        </div>
      </div>

      <!-- MP -->
      <div class="res-row">
        <span class="res-label" style="color:#93c5fd;">MP</span>
        <div class="bar-wrap">
          <div class="bar-fill bar-mp" style="width:${mpPct}%"></div>
          <div class="bar-text">${c.mp} / ${c.maxMp}</div>
        </div>
        <div class="res-btns">
          <button class="btn-mp" onclick="adjustPool('${c.id}','mp',-10)">-10</button>
          <input type="number" id="delta-mp-${c.id}" value="10">
          <button class="btn-mp" onclick="adjustPoolCustom('${c.id}','mp',-1)">-</button>
          <button class="btn-mp" onclick="adjustPoolCustom('${c.id}','mp',1)">+</button>
          <button class="btn-mp" onclick="adjustPool('${c.id}','mp',10)">+10</button>
        </div>
      </div>

      <!-- SP -->
      <div class="res-row">
        <span class="res-label" style="color:#6ee7b7;">SP</span>
        <div class="bar-wrap">
          <div class="bar-fill bar-sp" style="width:${spPct}%"></div>
          <div class="bar-text">${c.sp} / ${c.maxSp}</div>
        </div>
        <div class="res-btns">
          <button class="btn-sp" onclick="adjustPool('${c.id}','sp',-10)">-10</button>
          <input type="number" id="delta-sp-${c.id}" value="10">
          <button class="btn-sp" onclick="adjustPoolCustom('${c.id}','sp',-1)">-</button>
          <button class="btn-sp" onclick="adjustPoolCustom('${c.id}','sp',1)">+</button>
          <button class="btn-sp" onclick="adjustPool('${c.id}','sp',10)">+10</button>
        </div>
      </div>

      <div class="drawer-toggle">
        <span>💰 Gold: <strong style="color:#fde68a;">${c.gold} G</strong></span>
        <button onclick="toggleDmDrawer('${c.id}')">🎒 Inventory & Audit ▾</button>
      </div>

      <div id="dm-drawer-${c.id}" class="char-drawer">
        <div class="inventory-box">
          ${(c.inventory || []).length === 0 ? '<div style="font-size:11px; color:var(--text-muted); text-align:center;">No items.</div>' : ''}
          ${(c.inventory || []).map((item) => `
            <div class="item-row">
              <div class="item-info">
                <span class="item-type-badge">${escapeHtml(item.type)}</span>
                <strong>${escapeHtml(item.name)}</strong> (x${item.qty})
              </div>
            </div>
          `).join('')}
        </div>
        <div class="audit-log">
          ${(c.auditLog || []).slice().reverse().map(e => `<div>${escapeHtml(e)}</div>`).join('')}
        </div>
      </div>
    `;
    list.appendChild(card);
  });
}

function toggleDmDrawer(id) {
  document.getElementById(`dm-drawer-${id}`).classList.toggle('open');
}

function addAuditEntry(charObj, text) {
  const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  charObj.auditLog = charObj.auditLog || [];
  charObj.auditLog.push(`[${stamp}] ${text}`);
  if (charObj.auditLog.length > 50) charObj.auditLog.shift();
}

function adjustPool(id, pool, delta) {
  const c = sessionState.data.characters.find(x => x.id === id);
  if (!c) return;
  const maxKey = pool === 'hp' ? 'maxHp' : (pool === 'mp' ? 'maxMp' : 'maxSp');
  const before = c[pool];
  c[pool] = Math.max(0, Math.min(c[maxKey], c[pool] + delta));
  addAuditEntry(c, `${pool.toUpperCase()} adjusted by ${delta} (${before} → ${c[pool]})`);
  saveCurrentParty();
  renderDmCharacters();
}

function adjustPoolCustom(id, pool, sign) {
  const val = parseInt(document.getElementById(`delta-${pool}-${id}`).value, 10) || 10;
  adjustPool(id, pool, val * sign);
}

function levelUpChar(id) {
  const c = sessionState.data.characters.find(x => x.id === id);
  if (!c) return;
  c.level += 1;
  c.maxHp += 10;
  c.hp += 10;
  addAuditEntry(c, `Leveled up to Lv.${c.level}!`);
  saveCurrentParty();
  renderDmCharacters();
}

function applyAoE(pool, sign) {
  const amt = parseInt(document.getElementById('aoeAmount').value, 10) || 0;
  const delta = amt * sign;
  sessionState.data.characters.filter(c => c.type === 'PC').forEach(c => {
    c[pool] = Math.max(0, Math.min(c.maxHp, c[pool] + delta));
    addAuditEntry(c, `Party AoE: ${pool.toUpperCase()} ${delta}`);
  });
  saveCurrentParty();
  renderDmCharacters();
}

function fullRestParty() {
  sessionState.data.characters.filter(c => c.type === 'PC').forEach(c => {
    c.hp = c.maxHp; c.mp = c.maxMp; c.sp = c.maxSp;
    addAuditEntry(c, `Full Party Rest.`);
  });
  saveCurrentParty();
  renderDmCharacters();
}

function openCharacterModal(editId) {
  const modal = document.getElementById('charModal');
  document.getElementById('editCharId').value = editId || '';
  if (editId) {
    const c = sessionState.data.characters.find(x => x.id === editId);
    if (c) {
      document.getElementById('charModalTitle').textContent = `Edit ${c.name}`;
      document.getElementById('cName').value = c.name;
      document.getElementById('cType').value = c.type;
      document.getElementById('cRace').value = c.race || '';
      document.getElementById('cClass').value = c.className || '';
      document.getElementById('cLevel').value = c.level;
      document.getElementById('cArmor').value = c.armor || '';
      ['STR','DEX','CON','INT','WIS','CHA','LCK'].forEach(st => {
        document.getElementById('c' + st).value = c.stats[st];
      });
      document.getElementById('cMaxHP').value = c.maxHp;
      document.getElementById('cMaxMP').value = c.maxMp;
      document.getElementById('cMaxSP').value = c.maxSp;
      document.getElementById('cGold').value = c.gold;
    }
  } else {
    document.getElementById('charModalTitle').textContent = 'Add Character';
    document.getElementById('cName').value = '';
    ['STR','DEX','CON','INT','WIS','CHA','LCK'].forEach(st => document.getElementById('c' + st).value = 10);
  }
  modal.classList.add('open');
}

function closeCharacterModal() { document.getElementById('charModal').classList.remove('open'); }

function saveCharacterFromModal() {
  const editId = document.getElementById('editCharId').value;
  const name = document.getElementById('cName').value.trim() || 'Unnamed';
  const type = document.getElementById('cType').value;
  const race = document.getElementById('cRace').value.trim();
  const className = document.getElementById('cClass').value.trim();
  const level = parseInt(document.getElementById('cLevel').value, 10) || 1;
  const armor = document.getElementById('cArmor').value.trim();
  const stats = {};
  ['STR','DEX','CON','INT','WIS','CHA','LCK'].forEach(st => {
    stats[st] = parseInt(document.getElementById('c' + st).value, 10) || 10;
  });
  const maxHp = parseInt(document.getElementById('cMaxHP').value, 10) || 100;
  const maxMp = parseInt(document.getElementById('cMaxMP').value, 10) || 20;
  const maxSp = parseInt(document.getElementById('cMaxSP').value, 10) || 80;
  const gold = parseInt(document.getElementById('cGold').value, 10) || 0;

  if (editId) {
    const c = sessionState.data.characters.find(x => x.id === editId);
    if (c) {
      c.name = name; c.type = type; c.race = race; c.className = className;
      c.level = level; c.armor = armor; c.stats = stats;
      c.maxHp = maxHp; c.hp = Math.min(c.hp, maxHp);
      c.maxMp = maxMp; c.mp = Math.min(c.mp, maxMp);
      c.maxSp = maxSp; c.sp = Math.min(c.sp, maxSp);
      c.gold = gold;
    }
  } else {
    sessionState.data.characters.push({
      id: 'char-' + Date.now(),
      name, type, race, className, level, armor, stats,
      hp: maxHp, maxHp, mp: maxMp, maxMp, sp: maxSp, maxSp, gold,
      inventory: [{ name: 'Starter Kit', qty: 1, type: 'Misc' }],
      auditLog: [`[Created] Character initialized.`]
    });
  }
  closeCharacterModal();
  saveCurrentParty();
  renderDmCharacters();
}

function deleteCharacter(id) {
  if (!confirm('Remove character?')) return;
  sessionState.data.characters = sessionState.data.characters.filter(x => x.id !== id);
  saveCurrentParty();
  renderDmCharacters();
}

// Notebooks
function renderCategoryTabs() {
  const container = document.getElementById('catTabs');
  container.innerHTML = '';
  CATEGORIES.forEach(cat => {
    const btn = document.createElement('div');
    btn.className = `cat-tab ${sessionState.data.activeCategory === cat ? 'active' : ''}`;
    btn.textContent = cat;
    btn.onclick = () => { sessionState.data.activeCategory = cat; renderCategoryTabs(); renderNotesList(); };
    container.appendChild(btn);
  });
}

function renderNotesList() {
  const list = document.getElementById('notesList');
  const query = (document.getElementById('noteSearch').value || '').toLowerCase().trim();
  list.innerHTML = '';

  const filtered = sessionState.data.notes.filter(n => {
    const matchesCat = sessionState.data.activeCategory === 'All Notes' || n.category === sessionState.data.activeCategory;
    const matchesQuery = !query || n.title.toLowerCase().includes(query) || (n.tags || '').toLowerCase().includes(query);
    return matchesCat && matchesQuery;
  });

  filtered.forEach(n => {
    const item = document.createElement('div');
    item.className = `note-item ${sessionState.data.activeNoteId === n.id ? 'active' : ''}`;
    item.onclick = () => selectNote(n.id);
    item.innerHTML = `<div class="note-item-title">${escapeHtml(n.title)}</div><div class="note-item-meta"><span>📁 ${escapeHtml(n.category)}</span></div>`;
    list.appendChild(item);
  });
}

function selectNote(id) {
  sessionState.data.activeNoteId = id;
  const note = sessionState.data.notes.find(n => n.id === id);
  if (note) {
    document.getElementById('noteTitle').value = note.title || '';
    document.getElementById('noteCategory').value = note.category || 'Plot Hooks & Quests';
    document.getElementById('noteTags').value = note.tags || '';
    document.getElementById('noteContent').value = note.content || '';
  }
  renderNotesList();
}

function createNewNote() {
  const cat = sessionState.data.activeCategory === 'All Notes' ? 'Plot Hooks & Quests' : sessionState.data.activeCategory;
  const newNote = { id: 'note-' + Date.now(), title: 'New Note', category: cat, tags: '#campaign', content: '' };
  sessionState.data.notes.unshift(newNote);
  selectNote(newNote.id);
  saveCurrentParty();
}

function saveActiveNote() {
  const note = sessionState.data.notes.find(n => n.id === sessionState.data.activeNoteId);
  if (!note) return;
  note.title = document.getElementById('noteTitle').value;
  note.category = document.getElementById('noteCategory').value;
  note.tags = document.getElementById('noteTags').value;
  note.content = document.getElementById('noteContent').value;
  saveCurrentParty();
  renderNotesList();
}

function deleteActiveNote() {
  if (!sessionState.data.activeNoteId || !confirm('Delete note?')) return;
  sessionState.data.notes = sessionState.data.notes.filter(n => n.id !== sessionState.data.activeNoteId);
  sessionState.data.activeNoteId = sessionState.data.notes[0] ? sessionState.data.notes[0].id : null;
  saveCurrentParty();
  renderNotesList();
  if (sessionState.data.activeNoteId) selectNote(sessionState.data.activeNoteId);
}

function quickRoll(sides) {
  const r = Math.floor(Math.random() * sides) + 1;
  document.getElementById('dmDiceOutput').textContent = `🎲 d${sides} Roll: ${r}`;
}

// PLAYER APP LOGIC
function initPlayerApp() {
  loadParty(sessionState.partyCode);
  renderPlayerView();
}

function renderPlayerView() {
  const container = document.getElementById('playerWorkspaceContent');
  const c = sessionState.data.characters.find(x => x.name.toLowerCase() === sessionState.playerName.toLowerCase());

  if (!c) {
    container.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:40px;">Character profile not found in party.</div>`;
    return;
  }

  const hpPct = Math.max(0, Math.min(100, Math.round((c.hp / Math.max(1, c.maxHp)) * 100)));
  const mpPct = Math.max(0, Math.min(100, Math.round((c.mp / Math.max(1, c.maxMp)) * 100)));
  const spPct = Math.max(0, Math.min(100, Math.round((c.sp / Math.max(1, c.maxSp)) * 100)));

  container.innerHTML = `
    <div class="player-header-card">
      <div class="char-top">
        <div>
          <div class="char-title" style="font-size:18px; font-family:'Cinzel', serif;">
            <span>${escapeHtml(c.name)}</span>
            <span class="badge">Lv.${c.level} ${escapeHtml(c.race || '')} ${escapeHtml(c.className || '')}</span>
          </div>
          <div style="font-size:12px; color:var(--text-muted); margin-top:5px;">🛡️ Armor: ${escapeHtml(c.armor || 'None')}</div>
        </div>
        <button onclick="initPlayerApp()">🔄 Refresh Sheet</button>
      </div>

      <div class="stats-grid" style="padding:10px;">
        ${['STR','DEX','CON','INT','WIS','CHA','LCK'].map(st => `
          <div class="stat-cell">
            <span style="font-size:11px;">${st}</span>
            <strong style="font-size:13px;">${c.stats[st]} (${formatMod(c.stats[st])})</strong>
          </div>
        `).join('')}
      </div>

      <!-- HP -->
      <div class="res-row">
        <span class="res-label" style="color:#fca5a5; font-size:13px;">HP</span>
        <div class="bar-wrap" style="height:22px;">
          <div class="bar-fill bar-hp" style="width:${hpPct}%"></div>
          <div class="bar-text" style="font-size:12px;">${c.hp} / ${c.maxHp}</div>
        </div>
      </div>

      <!-- MP -->
      <div class="res-row">
        <span class="res-label" style="color:#93c5fd; font-size:13px;">MP</span>
        <div class="bar-wrap" style="height:22px;">
          <div class="bar-fill bar-mp" style="width:${mpPct}%"></div>
          <div class="bar-text" style="font-size:12px;">${c.mp} / ${c.maxMp}</div>
        </div>
      </div>

      <!-- SP -->
      <div class="res-row">
        <span class="res-label" style="color:#6ee7b7; font-size:13px;">SP</span>
        <div class="bar-wrap" style="height:22px;">
          <div class="bar-fill bar-sp" style="width:${spPct}%"></div>
          <div class="bar-text" style="font-size:12px;">${c.sp} / ${c.maxSp}</div>
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border); padding-top:12px;">
        <span>💰 Gold: <strong style="color:#fde68a; font-size:14px;">${c.gold} G</strong></span>
      </div>
    </div>

    <!-- Inventory Section for Player -->
    <div class="player-header-card">
      <strong style="font-family:'Cinzel', serif;">🎒 Your Inventory & Equipment</strong>
      <div class="inventory-box" style="max-height:220px;">
        ${(c.inventory || []).length === 0 ? '<div style="font-size:11px; color:var(--text-muted); text-align:center; padding:10px;">Inventory is empty.</div>' : ''}
        ${(c.inventory || []).map((item, idx) => `
          <div class="item-row">
            <div class="item-info">
              <span class="item-type-badge">${escapeHtml(item.type)}</span>
              <strong>${escapeHtml(item.name)}</strong> (x${item.qty})
            </div>
            <div style="display:flex; gap:4px;">
              <button onclick="playerChangeQty('${c.id}', ${idx}, -1)">-</button>
              <button onclick="playerChangeQty('${c.id}', ${idx}, 1)">+</button>
              <button class="btn-danger" onclick="playerRemoveItem('${c.id}', ${idx})">✕</button>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="form-row" style="margin-top:6px;">
        <input type="text" id="playerNewItemName" placeholder="Item name..." style="flex:2;">
        <input type="number" id="playerNewItemQty" value="1" min="1" style="flex:0.6;">
        <select id="playerNewItemType" style="flex:1;">
          <option value="Weapon">Weapon</option>
          <option value="Armor">Armor</option>
          <option value="Potion">Potion</option>
          <option value="Scroll">Scroll</option>
          <option value="Quest">Quest</option>
          <option value="Misc">Misc</option>
        </select>
        <button class="btn-accent" onclick="playerAddItem('${c.id}')">+ Add</button>
      </div>
    </div>

    <!-- Audit Log -->
    <div class="player-header-card">
      <strong style="font-family:'Cinzel', serif;">📜 Character Session Log</strong>
      <div class="audit-log" style="max-height:140px; font-size:11px;">
        ${(c.auditLog || []).slice().reverse().map(e => `<div>${escapeHtml(e)}</div>`).join('')}
      </div>
    </div>
  `;
}

function playerAddItem(charId) {
  loadParty(sessionState.partyCode);
  const c = sessionState.data.characters.find(x => x.id === charId);
  const nameInp = document.getElementById('playerNewItemName');
  const qtyInp = document.getElementById('playerNewItemQty');
  const typeInp = document.getElementById('playerNewItemType');
  if (!c || !nameInp || !nameInp.value.trim()) return;

  c.inventory = c.inventory || [];
  c.inventory.push({ name: nameInp.value.trim(), qty: parseInt(qtyInp.value, 10) || 1, type: typeInp.value });
  addAuditEntry(c, `Acquired item: ${nameInp.value.trim()}`);
  saveCurrentParty();
  renderPlayerView();
}

function playerChangeQty(charId, idx, delta) {
  loadParty(sessionState.partyCode);
  const c = sessionState.data.characters.find(x => x.id === charId);
  if (!c || !c.inventory[idx]) return;
  c.inventory[idx].qty += delta;
  if (c.inventory[idx].qty <= 0) c.inventory.splice(idx, 1);
  saveCurrentParty();
  renderPlayerView();
}

function playerRemoveItem(charId, idx) {
  loadParty(sessionState.partyCode);
  const c = sessionState.data.characters.find(x => x.id === charId);
  if (!c || !c.inventory[idx]) return;
  c.inventory.splice(idx, 1);
  saveCurrentParty();
  renderPlayerView();
}

function quickRollPlayer(sides) {
  const r = Math.floor(Math.random() * sides) + 1;
  alert(`🎲 d${sides} Roll Result: ${r}`);
}

function exportData() {
  const blob = new Blob([JSON.stringify(sessionState.data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `campaign_${sessionState.partyCode}_backup.json`;
  a.click();
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (parsed.characters && parsed.notes) {
        sessionState.data = parsed;
        saveCurrentParty();
        initDmApp();
        alert('Data imported successfully!');
      }
    } catch (err) { alert('Invalid JSON file.'); }
  };
  reader.readAsText(file);
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}