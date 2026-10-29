const byId = id => document.getElementById(id);
const hide = el => el.classList.add('hidden');
const show = el => el.classList.remove('hidden');
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

/** DOM-only presentation; all game rules and purchase validation belong to the game. */
export class UI {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;
    this.menu = byId('menu'); this.pause = byId('pause'); this.shop = byId('shop');
    this.over = byId('game-over'); this.hud = byId('hud');
    this.timers = {};
    let saved = .1;
    try { const value = Number(localStorage.getItem('deadHouseSensitivity')); if (value >= .03 && value <= .3) saved = value; } catch (_) { /* storage can be unavailable */ }
    this.setSensitivity(saved);
    document.querySelectorAll('.sensitivity').forEach(input => input.addEventListener('input', () => {
      this.setSensitivity(Number(input.value));
      try { localStorage.setItem('deadHouseSensitivity', String(this.sensitivity)); } catch (_) { /* keep session setting */ }
      this.callbacks.onSensitivity?.(this.sensitivity);
    }));
    byId('start-button').addEventListener('click', () => this.callbacks.onStart?.());
    byId('resume-button').addEventListener('click', () => this.callbacks.onResume?.());
    byId('restart-button').addEventListener('click', () => this.callbacks.onRestart?.());
    byId('close-shop').addEventListener('click', () => this.callbacks.onCloseShop?.());
  }
  setSensitivity(value) {
    this.sensitivity = clamp(Number.isFinite(Number(value)) ? Number(value) : .1, .03, .3);
    document.querySelectorAll('.sensitivity').forEach(input => { input.value = this.sensitivity; });
    document.querySelectorAll('.sensitivity-value').forEach(output => { output.textContent = `${this.sensitivity.toFixed(2)}°`; });
  }
  getSensitivity() { return this.sensitivity; }
  showMenu() { show(this.menu); hide(this.pause); hide(this.shop); hide(this.over); hide(this.hud); }
  hideMenu() { hide(this.menu); show(this.hud); }
  showPlaying() { hide(this.menu); hide(this.pause); hide(this.shop); hide(this.over); show(this.hud); }
  showPause() { hide(this.shop); show(this.pause); }
  hidePause() { hide(this.pause); }
  showGameOver(stats = {}) {
    hide(this.pause); hide(this.shop); hide(this.menu); hide(this.hud);
    byId('result-wave').textContent = stats.wave ?? 0;
    byId('result-kills').textContent = stats.kills ?? 0;
    show(this.over);
  }
  setHUD(state = {}) {
    const set = (key, id, transform = x => x) => { if (state[key] !== undefined && state[key] !== null) byId(id).textContent = transform(state[key]); };
    set('health', 'hud-health', x => Math.max(0, Math.ceil(x)));
    set('money', 'hud-money', x => Math.floor(x));
    set('wave', 'hud-wave', x => String(x).padStart(2, '0'));
    set('ammo', 'hud-ammo'); set('reserve', 'hud-reserve'); set('weapon', 'hud-weapon', x => String(x).toUpperCase());
    if (state.health !== undefined) byId('health-bar').style.width = `${clamp(Number(state.health), 0, 100)}%`;
    if (state.stamina !== undefined) byId('stamina-bar').style.width = `${clamp(Number(state.stamina), 0, 100)}%`;
  }
  updateHUD(state) { this.setHUD(state); }
  showMessage(text, duration = 2400) {
    clearTimeout(this.timers.message); byId('message').textContent = text || '';
    byId('shop-status').textContent = this.shop.classList.contains('hidden') ? '' : (text || '');
    if (text && duration > 0) this.timers.message = setTimeout(() => { byId('message').textContent = ''; byId('shop-status').textContent = ''; }, duration);
  }
  announce(text, sub = '') { this.showMessage(sub ? `${text} — ${sub}` : text); }
  setPrompt(text) { byId('prompt').textContent = text || ''; }
  prompt(text) { this.setPrompt(text); }
  setWave(text) {
    clearTimeout(this.timers.wave); byId('wave-banner').textContent = text || '';
    if (text) this.timers.wave = setTimeout(() => { byId('wave-banner').textContent = ''; }, 3000);
  }
  showHit(headshot = false) {
    const marker = byId('hit-marker'); marker.classList.toggle('head', headshot); marker.classList.add('active');
    clearTimeout(this.timers.hit); this.timers.hit = setTimeout(() => marker.classList.remove('active'), 180);
  }
  hit(headshot) { this.showHit(headshot); }
  showDamage() {
    const overlay = byId('damage-overlay'); overlay.classList.add('active');
    clearTimeout(this.timers.damage); this.timers.damage = setTimeout(() => overlay.classList.remove('active'), 120);
  }
  damage() { this.showDamage(); }
  showShop(money, items = []) {
    // Accept both common argument orders without ever treating UI state as purchase authority.
    if (Array.isArray(money)) [items, money] = [money, items];
    byId('shop-money').textContent = Math.floor(Number(money) || 0);
    const list = byId('shop-items'); list.replaceChildren();
    for (const item of items) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'shop-item';
      const title = document.createElement('strong'); title.textContent = item.name;
      const desc = document.createElement('span'); desc.className = 'description'; desc.textContent = item.description || '';
      const price = document.createElement('span'); price.className = 'price';
      const cost = Number(item.cost ?? item.price ?? 0);
      price.textContent = item.owned ? 'OWNED' : `$${cost}`;
      button.disabled = !!item.owned || !!item.disabled || cost > Number(money);
      button.append(title, desc, price); button.addEventListener('click', () => this.callbacks.onBuy?.(item.id));
      list.append(button);
    }
    hide(this.pause); byId('shop-status').textContent = ''; show(this.shop);
  }
  hideShop() { hide(this.shop); }
}
export function createUI(callbacks) { return new UI(callbacks); }
