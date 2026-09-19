
(function(){
  // =====================================================================
  // PERSISTENCE: personal profile (private) + global leaderboard (shared)
  // =====================================================================
  const AVATARS = ['🧗','🧑‍🚀','🦊','🐧','🐲','🥷','👽','🐙'];

  // Private profile lives in this browser's localStorage, so a returning
  // player on the same device keeps their name, avatar, gems and records.
  function storGet(key){
    try{ return localStorage.getItem('vertigo:' + key); }
    catch(e){ return null; }
  }
  function storSet(key, value){
    try{ localStorage.setItem('vertigo:' + key, value); return true; }
    catch(e){ return false; }
  }

  function uid(){ return 'p' + Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4); }

  let player = null; // { id, name, avatar, gems, bestScore, bestFloor, gamesPlayed, ownedSkins, equippedSkin, ownedFx }

  function defaultPlayer(){
    return {
      id: uid(), name: '', avatar: AVATARS[0],
      gems: 10, bestScore: 0, bestFloor: 0, gamesPlayed: 0,
      ownedSkins: ['default'], equippedSkin: 'default', ownedFx: [], disabledFx: []
    };
  }

  function loadPlayer(){
    const raw = storGet('profile');
    if(raw){
      try{
        const p = JSON.parse(raw);
        return Object.assign(defaultPlayer(), p);
      }catch(e){}
    }
    return null;
  }

  let saveTimer = null;
  function savePlayer(){
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      storSet('profile', JSON.stringify(player));
    }, 250);
  }

  // Shared leaderboard lives server-side (see app/api/leaderboard/route.js)
  // so every player's best run is visible to everyone, not just this device.
  async function pushToLeaderboard(){
    if(!player.name) return;
    try{
      await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: player.id, name: player.name, avatar: player.avatar,
          score: player.bestScore, floor: player.bestFloor
        })
      });
    }catch(e){}
  }

  async function fetchLeaderboard(){
    try{
      const res = await fetch('/api/leaderboard');
      if(!res.ok) return [];
      const data = await res.json();
      return data.entries || [];
    }catch(e){ return []; }
  }

  // =====================================================================
  // SCREEN NAVIGATION
  // =====================================================================
  const screens = ['screenLoading','screenWelcome','screenHome','screenLeaderboard','screenGame'];
  function showScreen(id){
    screens.forEach(s => document.getElementById(s).classList.toggle('active', s === id));
    document.getElementById('bottomNav').style.display = (id === 'screenHome' || id === 'screenLeaderboard') ? 'flex' : 'none';
    document.querySelectorAll('.navitem').forEach(n => {
      n.classList.toggle('active', (id === 'screenHome' && n.dataset.nav === 'home') || (id === 'screenLeaderboard' && n.dataset.nav === 'leaderboard'));
    });
  }

  function showToast(msg){
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.getElementById('app').appendChild(t);
    setTimeout(() => t.remove(), 2100);
  }

  // =====================================================================
  // HOME SCREEN RENDERING
  // =====================================================================
  function renderHome(){
    document.getElementById('gemCountHome').textContent = player.gems;
    document.getElementById('homeAvatar').textContent = player.avatar;
    document.getElementById('homeName').textContent = player.name || 'Climber';
    document.getElementById('homeSub').textContent = player.gamesPlayed + (player.gamesPlayed === 1 ? ' run played' : ' runs played');
    document.getElementById('statBest').textContent = player.bestScore;
    document.getElementById('statFloor').textContent = player.bestFloor;
  }

  async function renderLeaderboardPreview(){
    const box = document.getElementById('lbPreview');
    box.innerHTML = '<div class="lb-empty">Loading rankings…</div>';
    const entries = await fetchLeaderboard();
    if(!entries.length){
      box.innerHTML = '<div class="lb-empty">No climbers yet — be the first on the board!</div>';
      return;
    }
    const top = entries.slice(0,3);
    box.innerHTML = top.map((e,i) => rowHtml(e, i+1, e.id === player.id)).join('');
  }

  function rowHtml(e, rank, isMe){
    const rc = rank===1?'top1':rank===2?'top2':rank===3?'top3':'';
    return `<div class="lb-row ${isMe?'me':''}">
      <div class="lb-rank ${rc}">${rank}</div>
      <div class="lb-avatar">${e.avatar||'🧗'}</div>
      <div class="lb-name">${escapeHtml(e.name||'Climber')}</div>
      <div class="lb-score">${e.score}</div>
    </div>`;
  }
  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  async function renderLeaderboardFull(){
    const listEl = document.getElementById('lbFullList');
    const myBar = document.getElementById('myRankBar');
    listEl.innerHTML = '<div class="lb-empty">Loading rankings…</div>';
    const entries = await fetchLeaderboard();
    if(!entries.length){
      listEl.innerHTML = '<div class="lb-empty">No climbers yet.<br>Play a run and bank a score to appear here!</div>';
      myBar.style.display = 'none';
      return;
    }
    listEl.innerHTML = entries.slice(0,50).map((e,i) => rowHtml(e, i+1, e.id === player.id)).join('');
    const myIndex = entries.findIndex(e => e.id === player.id);
    if(myIndex >= 0 && player.bestScore > 0){
      myBar.style.display = 'flex';
      myBar.innerHTML = `<div class="lb-rank" style="color:var(--amber);">#${myIndex+1}</div><div class="lb-avatar">${player.avatar}</div><div class="lb-name">You</div><div class="lb-score">${player.bestScore}</div>`;
    } else {
      myBar.style.display = 'none';
    }
  }

  // =====================================================================
  // NAV WIRING
  // =====================================================================
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => {
      const target = el.dataset.nav;
      if(target === 'home'){ renderHome(); renderLeaderboardPreview(); showScreen('screenHome'); }
      else if(target === 'leaderboard'){ showScreen('screenLeaderboard'); renderLeaderboardFull(); }
      else if(target === 'store'){ openStore('gems'); }
    });
  });
  document.getElementById('seeAllLink').onclick = () => { showScreen('screenLeaderboard'); renderLeaderboardFull(); };
  document.getElementById('refreshLbBtn').onclick = (e) => {
    e.currentTarget.classList.add('spinning');
    renderLeaderboardFull().finally(() => setTimeout(()=>e.currentTarget.classList.remove('spinning'), 400));
  };
  document.getElementById('gemBtnHome').onclick = () => openStore('gems');
  document.getElementById('editNameBtn').onclick = () => openNameEditor();

  document.getElementById('playBtn').onclick = () => {
    showScreen('screenGame');
    gemCount.textContent = player.gems;
    resetRun();
  };
  document.getElementById('backFromGame').onclick = () => {
    if(running && score > 0){
      confirmDialog(
        'Leave this run?',
        `You have ${score} unbanked points. Leaving now loses them.`,
        'Leave anyway', 'Keep climbing',
        () => { running = false; if(rafId) cancelAnimationFrame(rafId); goHome(); }
      );
    } else {
      running = false; if(rafId) cancelAnimationFrame(rafId);
      goHome();
    }
  };
  function goHome(){
    player.gamesPlayed++;
    savePlayer();
    renderHome();
    renderLeaderboardPreview();
    showScreen('screenHome');
  }

  function confirmDialog(title, msg, okLabel, cancelLabel, onOk){
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `
      <div style="font-size:30px;">⚠️</div>
      <h2>${title}</h2>
      <p>${msg}</p>
      <button class="obtn obtn-risk" id="cdOk">${okLabel}</button>
      <button class="obtn obtn-ghost" id="cdCancel">${cancelLabel}</button>
    `;
    stage.appendChild(ov);
    document.getElementById('cdOk').onclick = () => { ov.remove(); onOk(); };
    document.getElementById('cdCancel').onclick = () => ov.remove();
  }

  // =====================================================================
  // WELCOME / NAME ENTRY
  // =====================================================================
  function buildAvatarPicker(selected){
    const wrap = document.getElementById('avatarPicker');
    wrap.innerHTML = AVATARS.map(a => `<div class="avatar-opt ${a===selected?'sel':''}" data-a="${a}">${a}</div>`).join('');
    wrap.querySelectorAll('.avatar-opt').forEach(el => {
      el.onclick = () => {
        wrap.querySelectorAll('.avatar-opt').forEach(x => x.classList.remove('sel'));
        el.classList.add('sel');
      };
    });
  }
  function openNameEditor(){
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.style.position = 'fixed'; ov.style.borderRadius = '0';
    ov.innerHTML = `
      <div style="font-size:30px;">✏️</div>
      <h2>Edit Profile</h2>
      <div class="avatar-picker" id="editAvatarPicker" style="margin:10px 0;"></div>
      <input class="name-input" id="editNameInput" maxlength="14" value="${escapeHtml(player.name)}" style="margin-bottom:14px;" />
      <button class="obtn obtn-ok" id="saveNameBtn">Save</button>
      <button class="obtn obtn-ghost" id="cancelNameBtn">Cancel</button>
    `;
    document.body.appendChild(ov);
    const wrap = ov.querySelector('#editAvatarPicker');
    wrap.innerHTML = AVATARS.map(a => `<div class="avatar-opt ${a===player.avatar?'sel':''}" data-a="${a}">${a}</div>`).join('');
    let chosenAvatar = player.avatar;
    wrap.querySelectorAll('.avatar-opt').forEach(el => {
      el.onclick = () => { wrap.querySelectorAll('.avatar-opt').forEach(x=>x.classList.remove('sel')); el.classList.add('sel'); chosenAvatar = el.dataset.a; };
    });
    document.getElementById('saveNameBtn').onclick = async () => {
      const val = ov.querySelector('#editNameInput').value.trim();
      if(val){ player.name = val.slice(0,14); }
      player.avatar = chosenAvatar;
      savePlayer();
      if(player.bestScore > 0) await pushToLeaderboard();
      renderHome();
      ov.remove();
    };
    document.getElementById('cancelNameBtn').onclick = () => ov.remove();
  }

  document.getElementById('startBtn').onclick = async () => {
    const val = document.getElementById('nameInput').value.trim();
    player.name = val ? val.slice(0,14) : 'Climber' + Math.floor(Math.random()*9000+1000);
    const sel = document.querySelector('#avatarPicker .avatar-opt.sel');
    player.avatar = sel ? sel.dataset.a : AVATARS[0];
    savePlayer();
    renderHome();
    renderLeaderboardPreview();
    showScreen('screenHome');
  };

  // =====================================================================
  // GAME ENGINE (core climbing mechanic)
  // =====================================================================
  const stage = document.getElementById('stage');
  const camera = document.getElementById('camera');
  const tower = document.getElementById('tower');
  const movingBlockEl = document.getElementById('movingBlock');
  const scoreVal = document.getElementById('scoreVal');
  const multVal = document.getElementById('multVal');
  const bestVal = document.getElementById('bestVal');
  const bestBox = document.getElementById('bestBox');
  const riskFill = document.getElementById('riskFill');
  const gemCount = document.getElementById('gemCount');
  const levelBadge = document.getElementById('levelBadge');
  const starsBg = document.getElementById('starsBg');
  const app = document.getElementById('app');

  const BANK_RATE = 40; // gems earned = score / 40 — harder to earn so cosmetics feel like a real goal
  const COST_SLOWMO = 35, COST_STARTBOOST = 55, COST_WIDEZONE = 65, COST_REVIVE = 95;
  const COST_COMBOSHIELD = 45, COST_SURGE = 70, COST_AUTOCLIMB = 100;

  let stageW, blockH = 29;
  let blocks = [];
  let curW, curLeft;
  let movingLeft, movingDir, movingSpeed;
  let level = 0, score = 0, mult = 1.0;
  let running = false, rafId = null;
  let slowUntil = 0;
  let hasStartBoost = false, wideZoneRun = false, activeWideZone = false, reviveShield = 0;
  let comboShield = false, scoreSurgeBlocks = 0;
  let perfectStreak = 0;
  let cameraShift = 0;

  const SKINS = {
    default:  { name:'Classic', desc:'Included', price:0, bg:'linear-gradient(180deg, #1D1640, #150F26)', colors:[['#4DD8FF','#2AA8D6'],['#4DFFCF','#2AD6A6'],['#B6FF4D','#8DD62A'],['#FFE94D','#D6C22A'],['#FFB84D','#D68F2A'],['#FF8A4D','#D6642A'],['#FF4D6D','#D62A48'],['#FF4DC8','#D62AA0'],['#C24DFF','#9A2AD6']] },
    neon:     { name:'Acid Neon', desc:'Cyberpunk grid backdrop, blocks pulse with electric glow', price:130, bg:'linear-gradient(180deg, #170826, #05030D)', colors:[['#CFFF4D','#A0D62A'],['#4DFFD3','#2AD6AE'],['#FF4DE0','#D62AB8'],['#4DFF8D','#2AD668'],['#E0FF4D','#B8D62A']] },
    sunset:   { name:'Sunset', desc:'A full warm sky with a glowing sun behind your climb', price:210, bg:'linear-gradient(180deg, #2A0F3D, #7A2A4D 45%, #E8703D 80%)', colors:[['#FFD24D','#D6A82A'],['#FF9E4D','#D6792A'],['#FF6B4D','#D6482A'],['#FF4D7A','#D62A56'],['#E04DFF','#B82AD6']] },
    sakura:   { name:'Sakura', desc:'A soft dusk sky with drifting cherry blossom petals', price:250, bg:'linear-gradient(180deg, #2B1830, #5C2A4A 45%, #F2B6C6 100%)', colors:[['#FFD6E5','#E8A8BE'],['#FFB8D1','#D67FA0'],['#FF9EC0','#C2578A'],['#E8A8FF','#B87FE8'],['#FFF0D6','#E8C89A']] },
    glacial:  { name:'Glacier', desc:'Falling snow drifts over a real snow-covered ground', price:300, bg:'linear-gradient(180deg, #0D2A40, #071827)', colors:[['#D6F0FF','#A8CFE6'],['#9EE7FF','#6FBEDB'],['#4DD8FF','#2AA8D6'],['#4DA8FF','#2A7ED6'],['#8D9EFF','#6070D6']] },
    ocean:    { name:'Deep Ocean', desc:'Bioluminescent currents and rising bubbles in the deep', price:380, bg:'linear-gradient(180deg, #04141F, #063149 55%, #021018)', colors:[['#4DFFE0','#1FB89C'],['#4DD8FF','#1F8FD6'],['#4D9EFF','#1F5FD6'],['#8D4DFF','#5F1FD6'],['#4DFFA8','#1FD67A']] },
    lava:     { name:'Volcanic', desc:'Molten rock, rising embers, and a glowing magma pool', price:430, bg:'radial-gradient(circle at 50% 100%, #7A2200, #2E0A00 55%, #0D0300)', colors:[['#FF6A2E','#B8300A'],['#FF8A3D','#D6500F'],['#FFB84D','#E8720F'],['#FF3D1F','#A6200A'],['#FF9A00','#CC6E00']] },
    galaxy:   { name:'Galaxy', desc:'★ Flagship · a full living starfield with a shifting cosmic glow', price:480, bg:'radial-gradient(circle at 30% 20%, #2E1758, #150A34 55%, #060312)', colors:[['#241640','#120A24'],['#1B2A5E','#0D1836'],['#2E1758','#170B32'],['#150A24','#08040F'],['#3D1E6E','#1F1040'],['#0F1230','#060714']] },
    gold:     { name:'Pure Gold', desc:'★★ Ultra prestige · rotating golden light rays, sheer luxury', price:650, bg:'radial-gradient(circle at 50% 0%, #3A2600, #170F00 65%, #0A0700)', colors:[['#FFE9A8','#E6C36F'],['#FFDB6F','#D6AE3A'],['#FFC93A','#D69E1A'],['#FFB800','#CC9200'],['#E6A600','#B37F00']] },
  };
  const FX = {
    confetti:  { name:'Bank Confetti', desc:'A satisfying confetti burst every time you cash out', icon:'🎉', price:190 },
    stars:     { name:'Animated Starfield', desc:'A living night sky drifts behind the tower', icon:'🌌', price:150 },
    bloom:     { name:'Milestone Bloom', desc:'A radiant light sweep every 10 floors you climb', icon:'💠', price:240 },
    combofire: { name:'Combo Fire Aura', desc:'Land 5 PERFECT drops in a row and your blocks catch fire — breaking the streak fades it out', icon:'🔥', price:260 },
    trail:     { name:'Neon Trail', desc:'A glowing comet tail follows the moving block', icon:'💫', price:230 },
    impact:    { name:'Impact Shockwave', desc:'A shockwave ring on every single landing', icon:'💢', price:280 },
    particles: { name:'Perfect Hit Particles', desc:'A screen flash + particle burst on every PERFECT', icon:'✨', price:340 },
    fireworks: { name:'Record Fireworks', desc:'A fireworks show lights up the sky on a new personal best', icon:'🎆', price:400 },
  };

  function colorForLevel(l){ const set = SKINS[player.equippedSkin].colors; return set[l % set.length]; }
  function applySkinClass(el){
    el.classList.remove('skin-neon','skin-sunset','skin-sakura','skin-glacial','skin-ocean','skin-lava','skin-gold','skin-galaxy','skin-default');
    el.classList.add('skin-'+player.equippedSkin);
  }
  function applyStageTheme(){
    stage.classList.remove('theme-neon','theme-sunset','theme-sakura','theme-glacial','theme-ocean','theme-lava','theme-galaxy','theme-gold');
    if(player.equippedSkin !== 'default') stage.classList.add('theme-'+player.equippedSkin);
    manageGoldSparkles();
    manageSakuraPetals();
  }

  let goldSparkleInterval = null;
  function manageGoldSparkles(){
    if(goldSparkleInterval){ clearInterval(goldSparkleInterval); goldSparkleInterval = null; }
    if(player.equippedSkin === 'gold'){
      goldSparkleInterval = setInterval(() => {
        const gameActive = document.getElementById('screenGame').classList.contains('active');
        if(!gameActive || player.equippedSkin !== 'gold'){ clearInterval(goldSparkleInterval); goldSparkleInterval = null; return; }
        const s = document.createElement('div');
        s.className = 'gold-sparkle';
        s.style.left = (6 + Math.random()*88) + '%';
        s.style.animationDuration = (2.6 + Math.random()*2.2) + 's';
        stage.appendChild(s);
        setTimeout(() => s.remove(), 5000);
      }, 420);
    }
  }

  let sakuraPetalInterval = null;
  function manageSakuraPetals(){
    if(sakuraPetalInterval){ clearInterval(sakuraPetalInterval); sakuraPetalInterval = null; }
    if(player.equippedSkin === 'sakura'){
      sakuraPetalInterval = setInterval(() => {
        const gameActive = document.getElementById('screenGame').classList.contains('active');
        if(!gameActive || player.equippedSkin !== 'sakura'){ clearInterval(sakuraPetalInterval); sakuraPetalInterval = null; return; }
        const p = document.createElement('div');
        p.className = 'sakura-petal';
        const size = 7 + Math.random()*5;
        const dur = 4.2 + Math.random()*3.4;
        const rot = (Math.random() < 0.5 ? 1 : -1) * (280 + Math.random()*260);
        p.style.left = (Math.random()*100) + '%';
        p.style.width = size + 'px';
        p.style.height = (size*0.75) + 'px';
        p.style.setProperty('--dx1', (Math.random()*70-35) + 'px');
        p.style.setProperty('--dx2', (Math.random()*110-55) + 'px');
        p.style.setProperty('--rot', rot + 'deg');
        p.style.animationDuration = dur + 's';
        p.style.animationTimingFunction = 'ease-in-out';
        stage.appendChild(p);
        setTimeout(() => p.remove(), dur*1000 + 200);
      }, 480);
    }
  }
  function fxActive(key){ return player.ownedFx.includes(key) && !player.disabledFx.includes(key); }

  function updateGemsUI(){ gemCount.textContent = player.gems; document.getElementById('gemCountHome').textContent = player.gems; }
  function addGems(n){
    player.gems += n;
    updateGemsUI();
    savePlayer();
    if(n > 0){
      const t = document.createElement('div');
      t.className = 'gem-toast';
      t.textContent = '+' + n + ' 💎';
      app.appendChild(t);
      setTimeout(() => t.remove(), 950);
    }
  }
  function updateScore(){ scoreVal.textContent = score; multVal.textContent = 'x'+mult.toFixed(1); }
  function layout(){ stageW = stage.clientWidth || 380; }

  // ---------- Sound engine ----------
  let actx = null, soundOn = true;
  function ensureAudio(){ if(!actx){ try{ actx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } if(actx && actx.state==='suspended') actx.resume(); }
  function tone(freq, dur, type, gainPeak, delay){
    if(!actx || !soundOn) return;
    const t0 = actx.currentTime + (delay||0);
    const osc = actx.createOscillator(), gain = actx.createGain();
    osc.type = type||'sine'; osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(gainPeak||0.12, t0+0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
    osc.connect(gain).connect(actx.destination);
    osc.start(t0); osc.stop(t0+dur+0.02);
  }
  function sfxTick(){ tone(520,0.08,'triangle',0.08); }
  function sfxPerfect(c){ const base=660+Math.min(c,10)*40; tone(base,0.16,'sine',0.14); tone(base*1.5,0.14,'sine',0.08,0.03); }
  function sfxBank(){ tone(523,0.1,'square',0.1); tone(659,0.1,'square',0.1,0.09); tone(784,0.16,'square',0.12,0.18); }
  function sfxCrash(){ tone(160,0.35,'sawtooth',0.16); tone(90,0.4,'sawtooth',0.14,0.05); }
  function sfxRecord(){ [523,659,784,1046].forEach((f,i)=> tone(f,0.22,'sine',0.13,i*0.09)); }

  async function updateRecord(){
    let changed = false;
    if(score > player.bestScore){
      const first = player.bestScore === 0;
      player.bestScore = score;
      bestVal.textContent = player.bestScore;
      bestBox.classList.remove('pulse'); void bestBox.offsetWidth; bestBox.classList.add('pulse');
      if(!first){
        sfxRecord();
        const t = document.createElement('div');
        t.className = 'record-toast';
        t.innerHTML = '🏆 NEW RECORD!<br><span style="font-size:14px;">' + player.bestScore + ' pts</span>';
        stage.appendChild(t);
        setTimeout(() => t.remove(), 1150);
        spawnFireworks();
      }
      changed = true;
    }
    if(level > player.bestFloor){ player.bestFloor = level; changed = true; }
    if(changed){ savePlayer(); await pushToLeaderboard(); }
  }
  function shakeScreen(){ app.classList.remove('shake'); void app.offsetWidth; app.classList.add('shake'); }
  function spawnConfetti(){
    if(!fxActive('confetti')) return;
    const colors = ['#FFB84D','#4DD8FF','#FF4D9E','#4DFFA0','#FFE9A8','#C24DFF'];
    const shapes = ['rect','dot','ribbon'];
    const cx = 50, cy = 42;
    const fire = (count, delay, powerMul) => {
      for(let i=0;i<count;i++){
        const c = document.createElement('div');
        const shape = shapes[Math.floor(Math.random()*shapes.length)];
        c.className = 'confetti-piece confetti-' + shape;
        c.style.left = cx+'%';
        c.style.top = cy+'%';
        c.style.background = colors[Math.floor(Math.random()*colors.length)];
        const ang = Math.random()*Math.PI*2;
        const dist = (55 + Math.random()*130) * powerMul;
        const dx = Math.cos(ang)*dist;
        const dyOut = Math.sin(ang)*dist*0.55 - 18;
        const dyFall = Math.abs(Math.sin(ang))*40 + 90;
        c.style.setProperty('--cpt', `translate(${dx}px, ${dyOut}px)`);
        c.style.setProperty('--cpt2', `translate(${dx*1.35}px, ${dyOut+dyFall}px)`);
        c.style.setProperty('--crot', (Math.random()*900-450)+'deg');
        c.style.animationDelay = delay + (Math.random()*0.09)+'s';
        stage.appendChild(c);
        setTimeout(() => c.remove(), 1650+delay*1000);
      }
    };
    fire(26, 0, 1);
    fire(18, 0.1, 0.72);
  }
  function spawnFireworks(){
    if(!fxActive('fireworks')) return;
    const palette = [['#FFD24D','#FFF3C4'], ['#FF4D9E','#FFD1E8'], ['#4DD8FF','#D6F5FF'], ['#4DFFA0','#DFFFEC'], ['#C24DFF','#EBD1FF']];
    const bursts = [
      { size: 16, dist: 38 }, { size: 18, dist: 44 }, { size: 16, dist: 40 },
      { size: 20, dist: 48 }, { size: 30, dist: 62 }
    ];
    bursts.forEach((cfg, i) => {
      setTimeout(() => {
        const cx = 18+Math.random()*64, cy = 18+Math.random()*42;
        const isFinale = i === bursts.length-1;
        const [core, spark] = palette[i % palette.length];

        // A rocket streaks up from the base of the stage before the burst pops —
        // the anticipation beat real fireworks have before the flash.
        const rocket = document.createElement('div');
        rocket.className = 'firework-rocket';
        rocket.style.left = cx+'%';
        rocket.style.setProperty('--rty', cy+'%');
        rocket.style.background = core;
        stage.appendChild(rocket);
        setTimeout(() => rocket.remove(), 420);

        setTimeout(() => {
          if(isFinale){
            const ring = document.createElement('div');
            ring.className = 'firework-ring';
            ring.style.left = cx+'%'; ring.style.top = cy+'%';
            ring.style.borderColor = core;
            stage.appendChild(ring);
            setTimeout(() => ring.remove(), 620);
            sfxRecord();
          }
          for(let p=0;p<cfg.size;p++){
            const el = document.createElement('div');
            el.className = 'firework-burst' + (p % 4 === 0 ? ' firework-spark' : '');
            el.style.left = cx+'%'; el.style.top = cy+'%';
            el.style.background = p % 3 === 0 ? spark : core;
            const ang = (Math.PI*2/cfg.size)*p + (Math.random()*0.35-0.175);
            const dist = cfg.dist + Math.random()*18;
            el.style.setProperty('--fw', `translate(${Math.cos(ang)*dist}px, ${Math.sin(ang)*dist}px)`);
            el.style.setProperty('--fw2', `translate(${Math.cos(ang)*dist*1.15}px, ${Math.sin(ang)*dist*1.15+26}px)`);
            stage.appendChild(el);
            setTimeout(() => el.remove(), 1150);
          }
        }, 380);
      }, i*420);
    });
  }
  function spawnMilestoneBloom(atLevel){
    if(!fxActive('bloom')) return;
    const sweep = document.createElement('div');
    sweep.className = 'milestone-bloom';
    stage.appendChild(sweep);
    setTimeout(() => sweep.remove(), 950);

    const ring = document.createElement('div');
    ring.className = 'milestone-ring';
    stage.appendChild(ring);
    setTimeout(() => ring.remove(), 900);

    const label = document.createElement('div');
    label.className = 'milestone-label';
    label.textContent = '⛰️ FLOOR ' + atLevel;
    stage.appendChild(label);
    setTimeout(() => label.remove(), 1100);

    const sparkCount = 10;
    for(let i=0;i<sparkCount;i++){
      const s = document.createElement('div');
      s.className = 'milestone-spark';
      const ang = (Math.PI*2/sparkCount)*i;
      const dist = 70 + Math.random()*40;
      s.style.setProperty('--mst', `translate(${Math.cos(ang)*dist}px, ${Math.sin(ang)*dist}px)`);
      s.style.animationDelay = (Math.random()*0.12)+'s';
      stage.appendChild(s);
      setTimeout(() => s.remove(), 1050);
    }
  }
  function updateFireAura(){
    const wantsFire = fxActive('combofire') && perfectStreak >= 5;
    movingBlockEl.classList.toggle('fire-aura', wantsFire);
    const last = blocks[blocks.length-1];
    if(last) last.classList.toggle('fire-aura', wantsFire);
  }
  function updateRiskMeter(){
    const ratio = Math.min(1, (movingSpeed - 1.25) / (7.0 - 1.25));
    if(riskFill) riskFill.style.width = (ratio*100) + '%';
  }
  function applyFxVisuals(){
    starsBg.classList.toggle('on', fxActive('stars'));
    if(fxActive('stars') && starsBg.children.length === 0){
      // Three depth layers — dim/small far stars, mid stars, a few bright near
      // stars with their own glow — read as parallax depth rather than a flat sprinkle.
      const layers = [
        { count: 36, cls: 'star star-far' },
        { count: 20, cls: 'star star-mid' },
        { count: 8,  cls: 'star star-near' }
      ];
      layers.forEach(layer => {
        for(let i=0;i<layer.count;i++){
          const s = document.createElement('div');
          s.className = layer.cls;
          s.style.left = Math.random()*100+'%'; s.style.top = Math.random()*100+'%';
          s.style.animationDelay = (Math.random()*3.2)+'s';
          s.style.setProperty('--twinkleDur', (2 + Math.random()*2.4)+'s');
          starsBg.appendChild(s);
        }
      });
    }
  }

  let shootingStarTimer = null;
  function spawnShootingStar(){
    if(!fxActive('stars')) return;
    const s = document.createElement('div');
    s.className = 'shooting-star';
    s.style.top = (5 + Math.random()*35) + '%';
    s.style.left = (55 + Math.random()*35) + '%';
    starsBg.appendChild(s);
    setTimeout(() => s.remove(), 1100);
  }
  function scheduleShootingStar(){
    clearTimeout(shootingStarTimer);
    shootingStarTimer = setTimeout(() => {
      spawnShootingStar();
      scheduleShootingStar();
    }, 7000 + Math.random()*8000);
  }

  function resetRun(){
    layout();
    applyStageTheme();
    blocks = []; level = 0; score = 0; mult = 1.0;
    curW = stageW * 0.42; curLeft = (stageW - curW) / 2;
    if(hasStartBoost){ mult = 3.0; curW = stageW * 0.52; hasStartBoost = false; }
    activeWideZone = wideZoneRun;
    if(wideZoneRun){ curW = Math.max(curW, stageW * 0.5); wideZoneRun = false; }
    comboShield = false; scoreSurgeBlocks = 0; perfectStreak = 0;
    tower.innerHTML = ''; cameraShift = 0; camera.style.transform = 'translateY(0px)';
    const base = document.createElement('div');
    base.className = 'block'; base.style.width = curW+'px';
    const c0 = colorForLevel(0);
    base.style.background = `linear-gradient(150deg, ${c0[0]}, ${c0[1]})`;
    base.style.color = c0[0];
    applySkinClass(base);
    tower.appendChild(base); blocks.push(base);
    // movingBlockEl is a single DOM node reused across every run, so a
    // fire-aura class left over from the previous run (e.g. banking while
    // it was on) would otherwise still be showing on the very first block
    // here — clear it explicitly rather than waiting for the first drop.
    updateFireAura();
    updateScore();
    bestVal.textContent = player.bestScore;
    levelBadge.textContent = '⛰️ FLOOR 0';
    spawnMoving();
    running = true;
    if(rafId) cancelAnimationFrame(rafId);
    loop();
  }

  function spawnMoving(){
    const w = curW;
    movingBlockEl.style.width = w+'px'; movingBlockEl.style.height = blockH+'px';
    movingBlockEl.classList.toggle('trail', fxActive('trail'));
    const c = colorForLevel(level+1);
    movingBlockEl.style.background = `linear-gradient(150deg, ${c[0]}, ${c[1]})`;
    movingBlockEl.style.color = c[0];
    applySkinClass(movingBlockEl);
    movingBlockEl.style.bottom = ((level+1)*(blockH+3)) + 'px';
    movingLeft = Math.random() < 0.5 ? 0 : (stageW - w);
    movingDir = movingLeft === 0 ? 1 : -1;
    movingSpeed = 1.25 + level*0.155;
    if(movingSpeed > 7.0) movingSpeed = 7.0;
    updateRiskMeter();
  }

  let lastGhostAt = 0, lastEmberAt = 0;
  function loop(t){
    if(!running) return;
    const w = parseFloat(movingBlockEl.style.width);
    let speed = movingSpeed;
    if(performance.now() < slowUntil) speed *= 0.35;
    movingLeft += movingDir * speed;
    if(movingLeft <= 0){ movingLeft = 0; movingDir = 1; }
    if(movingLeft + w >= stageW){ movingLeft = stageW - w; movingDir = -1; }
    movingBlockEl.style.left = movingLeft + 'px';
    if(fxActive('trail') && t && t - lastGhostAt > 50){
      lastGhostAt = t;
      const ghost = document.createElement('div');
      ghost.className = 'ghost-trail';
      ghost.style.width = w+'px'; ghost.style.height = blockH+'px';
      ghost.style.left = movingLeft+'px'; ghost.style.bottom = movingBlockEl.style.bottom;
      ghost.style.background = movingBlockEl.style.background;
      camera.appendChild(ghost);
      requestAnimationFrame(() => { ghost.classList.add('fade'); });
      setTimeout(() => ghost.remove(), 420);
    }
    if(fxActive('combofire') && movingBlockEl.classList.contains('fire-aura') && t && t - lastEmberAt > 90){
      lastEmberAt = t;
      for(let i=0;i<2;i++){
        const ember = document.createElement('div');
        ember.className = 'fire-ember';
        ember.style.left = (movingLeft + 4 + Math.random()*(w-8)) + 'px';
        ember.style.bottom = movingBlockEl.style.bottom;
        ember.style.setProperty('--edx', (Math.random()*24-12)+'px');
        camera.appendChild(ember);
        setTimeout(() => ember.remove(), 620);
      }
    }
    rafId = requestAnimationFrame(loop);
  }

  function flashText(text, color, xPct){
    const el = document.createElement('div');
    el.className = 'drop-flash'; el.style.color = color; el.style.left = xPct + '%';
    el.style.bottom = (14 + cameraShift + (level+1)*(blockH+3) + 20) + 'px';
    el.style.transform = 'translateX(-50%)'; el.textContent = text;
    stage.appendChild(el);
    setTimeout(() => el.remove(), 620);
  }

  function flashPerfectRing(){
    const ring = document.createElement('div');
    ring.className = 'perfect-ring';
    // Tower blocks are centered by flexbox (align-items:center), not placed at curLeft —
    // so the ring must match that same centered position, not the raw physics curLeft.
    const renderedLeft = (stageW - curW) / 2;
    ring.style.left = renderedLeft + 'px';
    ring.style.width = curW + 'px';
    ring.style.bottom = (level*(blockH+3)) + 'px';
    camera.appendChild(ring);
    setTimeout(() => ring.remove(), 600);
  }

  function burstParticles(xPct, yPx, color){
    if(!fxActive('particles')) return;

    const flash = document.createElement('div');
    flash.className = 'screen-flash';
    flash.style.background = `radial-gradient(circle at ${xPct}% ${100 - Math.min(85, yPx/4)}%, ${color}55, transparent 62%)`;
    stage.appendChild(flash);
    setTimeout(() => flash.remove(), 380);

    const rays = document.createElement('div');
    rays.className = 'perfect-rays';
    rays.style.left = xPct + '%'; rays.style.bottom = yPx + 'px';
    rays.style.background = `repeating-conic-gradient(${color}00 0deg, ${color}99 3deg, ${color}00 10deg)`;
    stage.appendChild(rays);
    setTimeout(() => rays.remove(), 480);

    const ring = document.createElement('div');
    ring.className = 'impact-ring'; ring.style.borderColor = color;
    ring.style.left = xPct + '%'; ring.style.bottom = yPx + 'px';
    stage.appendChild(ring);
    setTimeout(() => ring.remove(), 520);

    for(let i=0;i<24;i++){
      const isSpark = i % 4 === 0;
      const p = document.createElement('div');
      p.className = isSpark ? 'particle particle-spark' : 'particle';
      const size = isSpark ? 2 + Math.random()*2 : 3 + Math.random()*5;
      p.style.width = size+'px'; p.style.height = (isSpark ? size*5 : size)+'px';
      p.style.left = xPct+'%'; p.style.bottom = yPx+'px';
      p.style.background = Math.random() < 0.55 ? color : '#fff';
      const ang = Math.random()*Math.PI*2, dist = 24+Math.random()*42;
      p.style.setProperty('--pt', `translate(${Math.cos(ang)*dist}px, ${-Math.sin(ang)*dist}px)`);
      p.style.setProperty('--prot', (ang*180/Math.PI+90)+'deg');
      stage.appendChild(p);
      setTimeout(() => p.remove(), 620);
    }
  }

  function placePerfectBlock(){
    level++;
    const c = colorForLevel(level);
    const b = document.createElement('div');
    b.className = 'block'; b.style.width = curW + 'px';
    b.style.background = `linear-gradient(150deg, ${c[0]}, ${c[1]})`;
    b.style.color = c[0];
    applySkinClass(b);
    tower.appendChild(b); blocks.push(b);
    mult = Math.min(mult + 0.2, 8);
    perfectStreak++;
    let gain = Math.round((10 + level*2) * mult);
    if(scoreSurgeBlocks > 0){ gain *= 2; scoreSurgeBlocks--; }
    score += gain;
    updateScore();
    levelBadge.textContent = '⛰️ FLOOR ' + level;
    if(level >= 5){
      cameraShift = (level-4) * (blockH+3);
      camera.style.transform = `translateY(${cameraShift}px)`;
    }
    updateFireAura();
  }

  function drop(){
    if(!running) return;
    const w = parseFloat(movingBlockEl.style.width);
    const left = movingLeft;
    const overlapLeft = Math.max(left, curLeft);
    const overlapRight = Math.min(left + w, curLeft + curW);
    const overlapW = overlapRight - overlapLeft;
    if(overlapW <= 0){ crash(); return; }

    const isEarly = level < 2;
    const perfectThreshold = isEarly ? 0.55 : 0.95;
    const perfect = overlapW >= curW * perfectThreshold;
    const floorRatio = isEarly ? 0.65 : 0.36;
    let newW = perfect ? curW : Math.max(overlapW, curW * floorRatio);
    if(activeWideZone && !perfect){ newW = Math.max(newW, overlapW + (curW - overlapW) * 0.6); }
    newW = Math.min(newW, curW);
    const overlapCenter = overlapLeft + overlapW/2;
    curLeft = Math.max(0, Math.min(stageW - newW, overlapCenter - newW/2));
    curW = newW; level++;

    const c = colorForLevel(level);
    const b = document.createElement('div');
    b.className = 'block'; b.style.width = curW + 'px';
    b.style.background = `linear-gradient(150deg, ${c[0]}, ${c[1]})`;
    b.style.color = c[0];
    applySkinClass(b);
    tower.appendChild(b); blocks.push(b);

    if(fxActive('impact')){
      const shockX = curLeft + curW/2;
      const shockY = 14 + cameraShift + (level-1)*(blockH+3) + blockH/2;

      const ring = document.createElement('div');
      ring.className = 'impact-ring impact-ring-primary'; ring.style.borderColor = c[0];
      ring.style.left = shockX + 'px'; ring.style.bottom = shockY + 'px';
      camera.appendChild(ring);
      setTimeout(() => ring.remove(), 520);

      const ring2 = document.createElement('div');
      ring2.className = 'impact-ring impact-ring-secondary'; ring2.style.borderColor = c[0];
      ring2.style.left = shockX + 'px'; ring2.style.bottom = shockY + 'px';
      camera.appendChild(ring2);
      setTimeout(() => ring2.remove(), 640);

      for(let i=0;i<7;i++){
        const deb = document.createElement('div');
        deb.className = 'impact-debris';
        deb.style.left = shockX + 'px'; deb.style.bottom = shockY + 'px';
        deb.style.background = i % 2 === 0 ? c[0] : '#DDE3F5';
        const ang = Math.PI + Math.random()*Math.PI;
        const dist = 14 + Math.random()*22;
        deb.style.setProperty('--dbt', `translate(${Math.cos(ang)*dist}px, ${Math.sin(ang)*dist*0.5}px)`);
        camera.appendChild(deb);
        setTimeout(() => deb.remove(), 460);
      }
    }

    const xPct = (curLeft + curW/2)/stageW*100;
    if(perfect){
      mult = Math.min(mult + 0.2, 8);
      perfectStreak++;
      flashText('PERFECT!', '#4DFFA0', xPct);
      flashPerfectRing();
      burstParticles(xPct, 14 + cameraShift + level*(blockH+3) + 14, c[0]);
      sfxPerfect(Math.round((mult-1)/0.2));
    } else {
      if(comboShield){ comboShield = false; showToast('Combo Insurance saved your streak!'); }
      else { mult = Math.max(1.0, mult - 0.3); perfectStreak = 0; }
      flashText('ok', '#8C9BC2', xPct);
      sfxTick();
    }

    let gain = Math.round((10 + level*2) * mult);
    if(scoreSurgeBlocks > 0){ gain *= 2; scoreSurgeBlocks--; flashText('x2!', '#FFD24D', xPct); }
    score += gain;
    updateScore();
    updateRecord();
    updateFireAura();
    levelBadge.textContent = '⛰️ FLOOR ' + level;

    if(level >= 5){
      cameraShift = (level-4) * (blockH+3);
      camera.style.transform = `translateY(${cameraShift}px)`;
    }
    if(curW < 6){ crash(); return; }
    spawnMoving();
    if(level > 0 && level % 10 === 0){ spawnMilestoneBloom(level); offerBankPrompt(); }
  }

  function offerBankPrompt(){
    running = false; if(rafId) cancelAnimationFrame(rafId);
    const gemsIfBank = Math.round(score / BANK_RATE);
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `
      <div style="font-size:34px;">⚡</div>
      <h2>Floor ${level}!</h2>
      <p>You have <b style="color:var(--amber)">${score} unbanked points</b> (≈ ${gemsIfBank} 💎).<br>The higher you climb, the faster and riskier it gets.</p>
      <button class="obtn obtn-ok" id="bankNow">Bank ≈ ${gemsIfBank} 💎</button>
      <button class="obtn obtn-risk" id="pushLuck">Keep Climbing</button>
    `;
    stage.appendChild(ov);
    document.getElementById('bankNow').onclick = () => { ov.remove(); bank(); };
    document.getElementById('pushLuck').onclick = () => { ov.remove(); running = true; loop(); };
  }

  function bank(){
    if(score > 0){ addGems(Math.round(score / BANK_RATE)); sfxBank(); showToast('Banked! Points secured 🏦'); spawnConfetti(); }
    resetRun();
  }

  function crash(){
    running = false; if(rafId) cancelAnimationFrame(rafId);
    sfxCrash(); shakeScreen();
    const ov = document.createElement('div');
    ov.className = 'overlay';
    if(reviveShield > 0){
      ov.innerHTML = `
        <div style="font-size:34px;">💥</div>
        <h2>Tower collapsed!</h2>
        <p>You were on floor ${level} with <b style="color:var(--amber)">${score} points</b>.<br>Your revive shield lets you continue <b>without losing anything</b>.</p>
        <button class="obtn obtn-ok" id="reviveBtn">💗 Use Shield (already owned)</button>
        <button class="obtn obtn-ghost" id="giveUpBtn">Lose it all & restart</button>
      `;
    } else {
      ov.innerHTML = `
        <div style="font-size:34px;">💥</div>
        <h2>Tower collapsed!</h2>
        <p>You were on floor ${level} with <b style="color:var(--amber)">${score} points</b> — lost since you didn't bank in time.</p>
        <button class="obtn obtn-gold" id="reviveBuyBtn">💗 Revive Shield for ${COST_REVIVE} 💎</button>
        <button class="obtn obtn-ghost" id="giveUpBtn">Restart without reviving</button>
      `;
    }
    stage.appendChild(ov);
    document.getElementById('giveUpBtn').onclick = () => { ov.remove(); resetRun(); };
    const rb = document.getElementById('reviveBtn');
    if(rb) rb.onclick = () => { reviveShield--; ov.remove(); reviveInPlace(); };
    const rbb = document.getElementById('reviveBuyBtn');
    if(rbb) rbb.onclick = () => {
      if(player.gems >= COST_REVIVE){ player.gems -= COST_REVIVE; updateGemsUI(); savePlayer(); ov.remove(); reviveInPlace(); }
      else { ov.remove(); openStore('gems'); }
    };
  }

  function reviveInPlace(){
    curW = Math.max(curW, stageW*0.42);
    curLeft = (stageW - curW)/2;
    const last = blocks[blocks.length-1];
    if(last){ last.style.width = curW+'px'; }
    spawnMoving(); running = true; loop();
  }

  let lastDropAt = 0;
  document.addEventListener('pointerdown', ensureAudio, {once:true});
  stage.addEventListener('pointerdown', (e) => {
    if(!running) return;
    const now = performance.now();
    if(now - lastDropAt < 150) return;
    lastDropAt = now; e.preventDefault(); drop();
  });

  document.getElementById('bankBtn').onclick = () => { if(running){ running=false; if(rafId) cancelAnimationFrame(rafId); bank(); } };
  document.getElementById('slowBtn').onclick = () => {
    if(player.gems < COST_SLOWMO) return openStore('gems');
    player.gems -= COST_SLOWMO; updateGemsUI(); savePlayer();
    slowUntil = performance.now() + 6000;
  };
  document.getElementById('chipRevive').onclick = () => {
    if(player.gems < COST_REVIVE) return openStore('gems');
    player.gems -= COST_REVIVE; updateGemsUI(); savePlayer(); reviveShield++;
  };
  document.getElementById('chipStart').onclick = () => {
    if(player.gems < COST_STARTBOOST) return openStore('gems');
    player.gems -= COST_STARTBOOST; updateGemsUI(); savePlayer(); hasStartBoost = true;
  };
  document.getElementById('chipWide').onclick = () => {
    if(player.gems < COST_WIDEZONE) return openStore('gems');
    player.gems -= COST_WIDEZONE; updateGemsUI(); savePlayer(); wideZoneRun = true;
  };
  document.getElementById('chipComboShield').onclick = () => {
    if(comboShield){ showToast('Combo Insurance already armed'); return; }
    if(player.gems < COST_COMBOSHIELD) return openStore('gems');
    player.gems -= COST_COMBOSHIELD; updateGemsUI(); savePlayer();
    comboShield = true;
    showToast('Combo Insurance armed — your next miss is forgiven');
  };
  document.getElementById('chipSurge').onclick = () => {
    if(player.gems < COST_SURGE) return openStore('gems');
    player.gems -= COST_SURGE; updateGemsUI(); savePlayer();
    scoreSurgeBlocks = 6;
    showToast('Score Surge! Next 6 blocks pay double');
  };
  document.getElementById('chipAuto').onclick = () => {
    if(!running){ showToast('Start climbing first'); return; }
    if(player.gems < COST_AUTOCLIMB) return openStore('gems');
    player.gems -= COST_AUTOCLIMB; updateGemsUI(); savePlayer();
    for(let i=0;i<3;i++) placePerfectBlock();
    updateRecord();
    spawnMoving();
    showToast('Auto-climbed 3 floors!');
  };
  document.getElementById('chipStore').onclick = () => openStore('cosmetics');
  document.getElementById('gemBtn').onclick = () => openStore('gems');
  document.getElementById('muteBtn').onclick = (e) => { soundOn = !soundOn; e.currentTarget.textContent = soundOn ? '🔊' : '🔇'; };

  // =====================================================================
  // STORE
  // =====================================================================
  function openStore(initialTab){
    if(document.getElementById('storeOverlay')) return;
    const wrap = document.createElement('div');
    wrap.className = 'store-overlay'; wrap.id = 'storeOverlay';
    wrap.innerHTML = `
      <div class="store-sheet">
        <h3>Store</h3>
        <div class="sub">Gems for gameplay edges · Cosmetics to customize your tower.</div>
        <div class="tabs">
          <div class="tab" data-tab="gems">💎 Gems</div>
          <div class="tab" data-tab="cosmetics">🎨 Skins</div>
          <div class="tab" data-tab="fx">🖼️ Visual FX</div>
        </div>
        <div id="tabGems"></div>
        <div id="tabCosmetics" style="display:none;"></div>
        <div id="tabFx" style="display:none;"></div>
        <button class="store-close" id="storeCloseBtn">Close</button>
        <div class="demo-note" id="demoNote">Visual mockup of the purchase flow for this prototype — no real payments processed.</div>
        <div class="demo-note" id="cosmeticNote" style="display:none;">Skins and effects are bought with gems earned or purchased in-game — they cost more than gameplay boosts on purpose, so they're a long-term goal to save toward.</div>
      </div>
    `;
    document.body.appendChild(wrap);

    const tabGems = wrap.querySelector('#tabGems');
    tabGems.innerHTML = `
      <div class="pack"><div class="pack-left"><div class="pack-gem"></div><div><div class="pack-amount">60 gems</div></div></div><button class="pack-buy" data-amt="60">$0.99</button></div>
      <div class="pack"><div class="pack-left"><div class="pack-gem"></div><div><div class="pack-amount">180 gems</div><div class="pack-bonus">+15% bonus</div></div></div><button class="pack-buy" data-amt="207">$2.99</button></div>
      <div class="pack best"><div class="pack-left"><div class="pack-gem"></div><div><div class="pack-amount">500 gems</div><div class="pack-bonus">⭐ Best value · +30%</div></div></div><button class="pack-buy" data-amt="650">$6.99</button></div>
      <div class="pack"><div class="pack-left"><div class="pack-gem"></div><div><div class="pack-amount">1200 gems</div><div class="pack-bonus">+40% bonus</div></div></div><button class="pack-buy" data-amt="1680">$14.99</button></div>
    `;
    tabGems.querySelectorAll('.pack-buy').forEach(btn => {
      btn.dataset.orig = btn.textContent;
      btn.onclick = () => { addGems(parseInt(btn.dataset.amt,10)); btn.textContent='✓ Done'; setTimeout(()=>{ btn.textContent = btn.dataset.orig; },900); };
    });

    function skinOrder(){ return Object.keys(SKINS).filter(k => k !== 'default').sort((a,b) => SKINS[a].price - SKINS[b].price); }
    function skinUnlockable(key){
      const order = skinOrder();
      const idx = order.indexOf(key);
      if(idx <= 0) return true;
      return player.ownedSkins.includes(order[idx-1]);
    }
    function renderCosmetics(){
      const tabC = wrap.querySelector('#tabCosmetics');
      tabC.innerHTML = Object.entries(SKINS).map(([key, skin]) => {
        const owned = player.ownedSkins.includes(key);
        const equipped = player.equippedSkin === key;
        const swatchGrad = skin.bg;
        const canAfford = player.gems >= skin.price;
        const unlockable = key === 'default' || skinUnlockable(key);
        let btnLabel, btnClass, desc;
        if(equipped){ btnLabel = '✓'; btnClass = ''; desc = 'Equipped'; }
        else if(owned){ btnLabel = 'Equip'; btnClass = ''; desc = 'Owned'; }
        else if(!unlockable){
          const order = skinOrder();
          const prevName = SKINS[order[order.indexOf(key)-1]].name;
          btnLabel = '🔒 Locked'; btnClass = 'disabled'; desc = `Unlock ${prevName} first`;
        } else { btnLabel = `${skin.price} 💎`; btnClass = canAfford ? '' : 'disabled'; desc = skin.desc; }
        return `<div class="skin-card ${equipped?'equipped':''}">
          <div class="skin-left"><div class="skin-swatch" style="background:${swatchGrad}"></div>
          <div><div class="skin-name">${skin.name}</div><div class="skin-desc">${desc}</div></div></div>
          <button class="skin-buy ${owned?'owned':''} ${btnClass}" data-key="${key}">${btnLabel}</button>
        </div>`;
      }).join('');
      tabC.querySelectorAll('.skin-buy').forEach(btn => {
        btn.onclick = () => {
          const key = btn.dataset.key, skin = SKINS[key];
          if(player.ownedSkins.includes(key)){ player.equippedSkin = key; savePlayer(); applyStageTheme(); renderCosmetics(); }
          else if(!skinUnlockable(key)){ return; }
          else if(player.gems >= skin.price){
            player.gems -= skin.price; updateGemsUI();
            player.ownedSkins.push(key); player.equippedSkin = key; savePlayer();
            applyStageTheme();
            renderCosmetics();
          }
        };
      });
    }
    renderCosmetics();

    function fxOrder(){ return Object.keys(FX).sort((a,b) => FX[a].price - FX[b].price); }
    function fxUnlockable(key){
      const order = fxOrder();
      const idx = order.indexOf(key);
      if(idx <= 0) return true;
      return player.ownedFx.includes(order[idx-1]);
    }
    function renderFx(){
      const tabF = wrap.querySelector('#tabFx');
      tabF.innerHTML = fxOrder().map((key) => {
        const fx = FX[key];
        const owned = player.ownedFx.includes(key);
        const active = fxActive(key);
        const canAfford = player.gems >= fx.price;
        const unlockable = fxUnlockable(key);
        let btnLabel, btnClass, statusTag;
        if(owned){
          btnLabel = active ? 'ON' : 'OFF'; btnClass = active ? 'owned' : 'off';
          statusTag = active ? '<span class="fx-tag fx-tag-active">Active</span>' : '<span class="fx-tag">Off</span>';
        } else if(!unlockable){
          const order = fxOrder();
          const prevName = FX[order[order.indexOf(key)-1]].name;
          btnLabel = '🔒 Locked'; btnClass = 'disabled';
          statusTag = `<span class="fx-tag">🔒 Unlock ${prevName} first</span>`;
        } else {
          btnLabel = `${fx.price} 💎`; btnClass = canAfford ? '' : 'disabled';
          statusTag = '';
        }
        return `<div class="fx-card"><div class="fx-icon">${fx.icon}</div>
          <div style="flex:1;"><div class="fx-name">${fx.name}</div><div class="fx-desc">${fx.desc}</div>${statusTag}</div>
          <button class="fx-buy ${btnClass}" data-key="${key}">${btnLabel}</button>
        </div>`;
      }).join('');
      tabF.querySelectorAll('.fx-buy').forEach(btn => {
        btn.onclick = () => {
          const key = btn.dataset.key, fx = FX[key];
          if(player.ownedFx.includes(key)){
            // Already owned: toggle it on/off instead of re-buying
            const idx = player.disabledFx.indexOf(key);
            if(idx >= 0) player.disabledFx.splice(idx,1); else player.disabledFx.push(key);
            savePlayer();
            applyFxVisuals();
            if(!fxActive('trail')) movingBlockEl.classList.remove('trail');
            renderFx();
          } else if(!fxUnlockable(key)){ return; }
          else if(player.gems >= fx.price){
            player.gems -= fx.price; updateGemsUI();
            player.ownedFx.push(key); savePlayer();
            applyFxVisuals();
            if(key === 'trail') movingBlockEl.classList.add('trail');
            renderFx();
          }
        };
      });
    }
    renderFx();

    wrap.querySelectorAll('.tab').forEach(t => {
      t.onclick = () => {
        wrap.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        wrap.querySelector('#tabGems').style.display = t.dataset.tab==='gems'?'':'none';
        wrap.querySelector('#tabCosmetics').style.display = t.dataset.tab==='cosmetics'?'':'none';
        wrap.querySelector('#tabFx').style.display = t.dataset.tab==='fx'?'':'none';
        wrap.querySelector('#demoNote').style.display = t.dataset.tab==='gems'?'':'none';
        wrap.querySelector('#cosmeticNote').style.display = t.dataset.tab==='gems'?'none':'';
      };
    });
    const startTab = wrap.querySelector(`.tab[data-tab="${initialTab||'gems'}"]`);
    if(startTab) startTab.click();
    document.getElementById('storeCloseBtn').onclick = () => wrap.remove();
  }

  window.addEventListener('resize', () => { layout(); });

  // =====================================================================
  // BOOT
  // =====================================================================
  async function boot(){
    scheduleShootingStar();
    const loaded = await loadPlayer();
    if(loaded){
      player = loaded;
      applyFxVisuals();
      renderHome();
      renderLeaderboardPreview();
      showScreen('screenHome');
    } else {
      player = defaultPlayer();
      buildAvatarPicker(player.avatar);
      showScreen('screenWelcome');
    }
  }
  boot();
})();
