// One place for the API address.
// Local pages talk to the dev server.
// GitHub Pages talks to the live server.
// The Pi, Tailscale, or a custom domain uses that same host.
var API;
(function () {
  var host = location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    API = "http://127.0.0.1:8000";
  } else if (host.endsWith("github.io")) {
    API = "https://macbook-air-od-david.tail74d12c.ts.net";
  } else {
    API = location.origin;
  }
})();
