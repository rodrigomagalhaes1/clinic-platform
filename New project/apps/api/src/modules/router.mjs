export function composeRouteModules(modules = []) {
  return {
    async handleWebhook(context) {
      for (const module of modules) {
        if (typeof module?.handleWebhook === "function" && await module.handleWebhook(context)) return true;
      }
      return false;
    },

    async handleRoute(context) {
      for (const module of modules) {
        if (typeof module?.handleRoute === "function" && await module.handleRoute(context)) return true;
      }
      return false;
    }
  };
}
