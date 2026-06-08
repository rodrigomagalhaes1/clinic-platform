export function createSettingsRegistriesModule(deps) {
  async function handleRoute({ request, response, url, method, currentUser }) {
    if (method === "GET" && url.pathname === "/v1/settings/navigation") {
      deps.sendJson(response, 200, { data: deps.systemNavigationOverrides() });
      return true;
    }

    if (method === "POST" && url.pathname === "/v1/settings/navigation/access-denied") {
      const body = await deps.readBody(request);
      const event = deps.logAudit(request, {
        user: currentUser,
        action: "settings.navigation_access_denied",
        resource: "system_navigation",
        resourceId: deps.optional(body.route) ?? "unknown",
        details: {
          route: deps.optional(body.route) ?? "",
          title: deps.optional(body.title) ?? "",
          reason: deps.optional(body.reason) ?? "denied",
          permission: deps.optional(body.permission) ?? "",
          status: deps.optional(body.status) ?? ""
        }
      });
      deps.sendJson(response, 201, { data: event });
      return true;
    }

    const navigationOverrideMatch = url.pathname.match(/^\/v1\/settings\/navigation\/([^/]+)$/);
    if (method === "PATCH" && navigationOverrideMatch) {
      if (!deps.hasPermission(currentUser, "edit_privileges")) {
        deps.sendError(response, 403, "Permissao operacional necessaria: edit_privileges");
        return true;
      }
      const route = decodeURIComponent(navigationOverrideMatch[1]);
      const body = await deps.readBody(request);
      const override = deps.updateSystemNavigationOverride(route, body, request, currentUser);
      deps.sendJson(response, 200, { data: override });
      return true;
    }

    if (method === "GET" && url.pathname === "/v1/registries") {
      deps.sendJson(response, 200, {
        data: deps.registryDefinitions.map((definition) => ({
          ...definition,
          count: deps.list(definition.collection).length
        }))
      });
      return true;
    }

    const registryMatch = url.pathname.match(/^\/v1\/registries\/([^/]+)$/);
    const registryRecordMatch = url.pathname.match(/^\/v1\/registries\/([^/]+)\/([^/]+)$/);
    if (!registryMatch && !registryRecordMatch) return false;

    const registryType = decodeURIComponent((registryMatch ?? registryRecordMatch)[1]);
    const definition = deps.registryDefinitionsByType.get(registryType);
    if (!definition) {
      deps.sendJson(response, 404, { error: { code: "not_found", message: "Registry type not found" } });
      return true;
    }

    if (method === "GET") {
      deps.sendJson(response, 200, { meta: definition, data: deps.list(definition.collection) });
      return true;
    }

    if (method === "POST") {
      const body = await deps.readBody(request);
      const payload = deps.sanitizeRegistryPayload(definition, body);
      const primaryValue = payload[definition.primaryField];
      if (!primaryValue) {
        deps.sendError(response, `${definition.primaryField} is required`);
        return true;
      }

      const record = deps.create(definition.collection, {
        id: deps.id("reg"),
        type: definition.type,
        clinicId: deps.clinicId(request),
        ...payload,
        createdAt: new Date().toISOString()
      });
      deps.sendJson(response, 201, { data: record });
      return true;
    }

    if (method === "PATCH" && registryRecordMatch) {
      const recordId = decodeURIComponent(registryRecordMatch[2]);
      const existing = deps.list(definition.collection).find((row) => String(row.id) === String(recordId));
      if (!existing) {
        deps.sendJson(response, 404, { error: { code: "not_found", message: "Registry record not found" } });
        return true;
      }
      const body = await deps.readBody(request);
      const patch = deps.sanitizeRegistryPayload(definition, body);
      const merged = {
        ...existing,
        ...patch,
        id: existing.id,
        type: definition.type,
        clinicId: existing.clinicId ?? deps.clinicId(request),
        updatedAt: new Date().toISOString()
      };
      deps.create(definition.collection, merged);
      deps.sendJson(response, 200, { data: merged });
      return true;
    }

    if (method === "DELETE" && registryRecordMatch) {
      const recordId = decodeURIComponent(registryRecordMatch[2]);
      const existing = deps.list(definition.collection).find((row) => String(row.id) === String(recordId));
      if (!existing) {
        deps.sendJson(response, 404, { error: { code: "not_found", message: "Registry record not found" } });
        return true;
      }

      const blockers = [];
      if (definition.type === "employees") {
        const linkedUsers = deps.list("security_users").filter((user) => String(user.professionalType) === "employee" && String(user.professionalId) === String(recordId) && user.status !== "inactive");
        if (linkedUsers.length) {
          blockers.push("Colaborador vinculado a usuario ativo.");
        }
      }
      if (definition.type === "procedures") {
        const inAppointments = deps.list("appointments").some((appointment) => String(appointment.procedureName ?? "") === String(existing.name ?? ""));
        if (inAppointments) {
          blockers.push("Procedimento em uso em agendamentos.");
        }
      }

      if (blockers.length) {
        deps.sendJson(response, 409, {
          error: {
            code: "registry_in_use",
            message: blockers.join(" ")
          }
        });
        return true;
      }

      deps.remove(definition.collection, recordId);
      deps.sendJson(response, 200, { data: { id: recordId, deleted: true } });
      return true;
    }

    return false;
  }

  return { handleRoute };
}
