// src/shared/clerk-browser.mjs
var loading;
function loadScript(src, attributes = {}) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.crossOrigin = "anonymous";
    for (const [name, value] of Object.entries(attributes)) script.setAttribute(name, value);
    script.onload = resolve;
    script.onerror = () => reject(new Error("Secure sign-in could not load. Please refresh and try again."));
    document.head.append(script);
  });
}
function loadClerk() {
  return loading ||= (async () => {
    const response = await fetch("/api/auth/config");
    if (!response.ok) throw new Error("Sign-in is temporarily unavailable. Please try again later.");
    const config = await response.json();
    if (config.provider !== "clerk") return null;
    await loadScript(config.frontendAPI + "/npm/@clerk/ui@1/dist/ui.browser.js");
    await loadScript(config.frontendAPI + "/npm/@clerk/clerk-js@6/dist/clerk.browser.js", { "data-clerk-publishable-key": config.publishableKey });
    await window.Clerk.load({ ui: { ClerkUI: window.__internal_ClerkUICtor }, telemetry: { disabled: true }, signInUrl: "/hq/sign-in", signUpUrl: "/hq/sign-up" });
    return window.Clerk;
  })();
}
async function startClerkPage() {
  const message = document.getElementById("auth-message");
  try {
    const clerk = await loadClerk();
    if (!clerk) throw new Error("Organization sign-in is being configured.");
    if (location.pathname.startsWith("/hq/sign-out")) {
      await clerk.signOut({ redirectUrl: "/hq/sign-in" });
      return;
    }
    if (clerk.session?.status === "active") {
      location.replace("/hq");
      return;
    }
    const options = { routing: "hash", forceRedirectUrl: "/hq", fallbackRedirectUrl: "/hq", signInUrl: "/hq/sign-in", signUpUrl: "/hq/sign-up" };
    if (location.pathname.startsWith("/hq/sign-up")) clerk.mountSignUp(document.getElementById("clerk-auth"), options);
    else clerk.mountSignIn(document.getElementById("clerk-auth"), options);
    message.textContent = "";
  } catch (error) {
    message.textContent = error.message;
  }
}

// src/app/clerk-page.mjs
startClerkPage();
