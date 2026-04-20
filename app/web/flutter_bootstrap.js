{{flutter_js}}
{{flutter_build_config}}

(function () {
  async function unregisterOldServiceWorkers() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    } catch (_) {
      // Ignore local preview cache cleanup failures.
    }
  }

  async function loadApp() {
    await _flutter.loader.load({
      onEntrypointLoaded: async function (engineInitializer) {
        const appRunner = await engineInitializer.initializeEngine();
        await appRunner.runApp();
      },
    });
  }

  unregisterOldServiceWorkers().finally(loadApp);
})();
