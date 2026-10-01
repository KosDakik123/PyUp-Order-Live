/**
 * App theme: light / dark. Persists in localStorage.
 * Usage: include theme.js, then call window.themeInit() after DOM ready.
 * Pages should use CSS variables: var(--app-bg), var(--app-surface), var(--app-text), var(--app-muted), var(--app-border)
 */
(function() {
  var STORAGE_KEY = 'pyup-theme';
  function get() {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'light';
    } catch (e) { return 'light'; }
  }
  function set(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (e) {}
    document.documentElement.setAttribute('data-theme', value);
  }
  function toggle() {
    var next = get() === 'dark' ? 'light' : 'dark';
    set(next);
    return next;
  }
  function init() {
    set(get());
  }
  window.themeInit = init;
  window.themeToggle = toggle;
  window.themeGet = get;
})();
