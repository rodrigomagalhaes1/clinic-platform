export function createWhatsappModule(deps) {
  async function handleWebhook({ request, response, url, method }) {
    if (method === "GET" && url.pathname === "/webhooks/relationship/whatsapp/cloud") {
      const config = deps.getWhatsappConfig();
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");
      if (mode === "subscribe" && token && token === config.verifyToken) {
        response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", ...deps.corsHeaders(), ...deps.securityHeaders() });
        response.end(challenge ?? "");
        return true;
      }
      deps.sendError(response, 403, "Token de verificacao invalido");
      return true;
    }

    if (method === "POST" && url.pathname === "/webhooks/relationship/whatsapp/cloud") {
      const body = await deps.readBody(request);
      const result = await deps.ingestWhatsappWebhook(body, request, deps.systemUser("Webhook WhatsApp Cloud"), "cloud-api");
      deps.sendJson(response, 201, { data: result });
      return true;
    }

    if (method === "POST" && url.pathname.startsWith("/webhooks/relationship/whatsapp/evolution")) {
      const config = deps.getWhatsappConfig();
      const providedSecret = request.headers["x-whatsapp-secret"] ?? url.searchParams.get("secret");
      if (!config.webhookSecret || String(providedSecret ?? "") !== String(config.webhookSecret)) {
        deps.sendError(response, 401, "Segredo do webhook WhatsApp invalido");
        return true;
      }
      const body = await deps.readBody(request);
      const result = await deps.ingestWhatsappWebhook(body, request, deps.systemUser("Webhook Evolution"), "evolution-api");
      deps.sendJson(response, 201, { data: result });
      return true;
    }

    return false;
  }

  async function handleRoute({ request, response, url, method, currentUser }) {
    if (method === "GET" && url.pathname === "/v1/relationship/whatsapp/config") {
      deps.sendJson(response, 200, { data: deps.publicWhatsappConfig(deps.getWhatsappConfig()) });
      return true;
    }

    if (method === "PATCH" && url.pathname === "/v1/relationship/whatsapp/config") {
      const body = await deps.readBody(request);
      const current = deps.getWhatsappConfig();
      const updated = deps.create("relationship_whatsapp_config", {
        ...current,
        id: "relationship_whatsapp_config",
        clinicId: deps.clinicId(request),
        provider: deps.optional(body.provider) ?? current.provider,
        cloudPhoneNumberId: deps.optional(body.cloudPhoneNumberId) ?? current.cloudPhoneNumberId,
        cloudAccessToken: deps.optional(body.cloudAccessToken) ?? current.cloudAccessToken,
        verifyToken: deps.optional(body.verifyToken) ?? current.verifyToken,
        evolutionBaseUrl: deps.optional(body.evolutionBaseUrl) ?? current.evolutionBaseUrl,
        evolutionInstance: deps.optional(body.evolutionInstance) ?? current.evolutionInstance,
        evolutionApiKey: deps.optional(body.evolutionApiKey) ?? current.evolutionApiKey,
        cloudGraphVersion: deps.optional(body.cloudGraphVersion) ?? current.cloudGraphVersion,
        ocrEngine: deps.optional(body.ocrEngine) ?? current.ocrEngine,
        ocrLanguage: deps.optional(body.ocrLanguage) ?? current.ocrLanguage,
        webhookSecret: deps.optional(body.webhookSecret) ?? current.webhookSecret,
        agentMode: deps.optional(body.agentMode) ?? current.agentMode,
        autoReplyEnabled: deps.booleanValue(body.autoReplyEnabled, current.autoReplyEnabled),
        autoSendEnabled: deps.booleanValue(body.autoSendEnabled, current.autoSendEnabled),
        autoScheduleEnabled: deps.booleanValue(body.autoScheduleEnabled, current.autoScheduleEnabled),
        autoCancelEnabled: deps.booleanValue(body.autoCancelEnabled, current.autoCancelEnabled),
        autoOrderReadingEnabled: deps.booleanValue(body.autoOrderReadingEnabled, current.autoOrderReadingEnabled),
        requireHumanReviewForLowConfidence: deps.booleanValue(body.requireHumanReviewForLowConfidence, current.requireHumanReviewForLowConfidence),
        retryLimit: Math.max(0, Number(body.retryLimit || current.retryLimit || 3)),
        minimumConfidence: Number(body.minimumConfidence || current.minimumConfidence || 0.72),
        status: deps.optional(body.status) ?? current.status,
        updatedBy: currentUser.id,
        updatedByName: currentUser.name,
        updatedAt: new Date().toISOString()
      });
      deps.auditWhatsapp(request, currentUser, "whatsapp.config_updated", updated, { provider: updated.provider, status: updated.status });
      deps.sendJson(response, 200, { data: deps.publicWhatsappConfig(updated) });
      return true;
    }

    if (method === "GET" && url.pathname === "/v1/relationship/whatsapp/readiness") {
      deps.sendJson(response, 200, { data: deps.buildWhatsappReadiness() });
      return true;
    }

    if (method === "GET" && url.pathname === "/v1/relationship/whatsapp/safety-dashboard") {
      deps.sendJson(response, 200, { data: deps.buildWhatsappSafetyDashboard(request, currentUser) });
      return true;
    }

    if (method === "GET" && url.pathname === "/v1/relationship/whatsapp/flows") {
      deps.sendJson(response, 200, { data: deps.whatsappFlows() });
      return true;
    }

    if (method === "POST" && url.pathname === "/v1/relationship/whatsapp/flows") {
      const body = await deps.readBody(request);
      const flow = deps.createWhatsappFlow(body, currentUser, request);
      deps.sendJson(response, 201, { data: flow });
      return true;
    }

    if (method === "GET" && url.pathname === "/v1/relationship/whatsapp/templates") {
      deps.sendJson(response, 200, { data: deps.whatsappTemplates() });
      return true;
    }

    if (method === "POST" && url.pathname === "/v1/relationship/whatsapp/templates") {
      const body = await deps.readBody(request);
      const template = deps.createWhatsappTemplate(body, currentUser, request);
      deps.sendJson(response, 201, { data: template });
      return true;
    }

    if (method === "GET" && url.pathname === "/v1/relationship/whatsapp/autonomy-rules") {
      deps.sendJson(response, 200, { data: deps.whatsappAutonomyRules() });
      return true;
    }

    if (method === "POST" && url.pathname === "/v1/relationship/whatsapp/autonomy-rules") {
      const body = await deps.readBody(request);
      const rule = deps.createWhatsappAutonomyRule(body, currentUser, request);
      deps.sendJson(response, 201, { data: rule });
      return true;
    }

    if (method === "GET" && url.pathname === "/v1/relationship/whatsapp/autonomy-profiles") {
      deps.sendJson(response, 200, { data: deps.whatsappAutonomyProfiles() });
      return true;
    }

    if (method === "POST" && url.pathname === "/v1/relationship/whatsapp/autonomy-profiles") {
      const body = await deps.readBody(request);
      const profile = deps.createWhatsappAutonomyProfile(body, currentUser, request);
      deps.sendJson(response, 201, { data: profile });
      return true;
    }

    if (method === "GET" && url.pathname === "/v1/relationship/whatsapp/journeys") {
      deps.sendJson(response, 200, { data: deps.whatsappJourneys() });
      return true;
    }

    if (method === "POST" && url.pathname === "/v1/relationship/whatsapp/journeys") {
      const body = await deps.readBody(request);
      const journey = deps.createWhatsappJourney(body, currentUser, request);
      deps.sendJson(response, 201, { data: journey });
      return true;
    }

    if (method === "GET" && url.pathname === "/v1/relationship/whatsapp/insurance-validation") {
      const validation = deps.validateWhatsappInsurance({
        insuranceName: url.searchParams.get("insuranceName") ?? "",
        procedureName: url.searchParams.get("procedureName") ?? "",
        guideNumber: url.searchParams.get("guideNumber") ?? "",
        authorizationCode: url.searchParams.get("authorizationCode") ?? ""
      });
      deps.sendJson(response, 200, { data: validation });
      return true;
    }

    if (method === "GET" && url.pathname === "/v1/relationship/whatsapp/prep-rules") {
      deps.sendJson(response, 200, { data: deps.whatsappPrepRules() });
      return true;
    }

    if (method === "POST" && url.pathname === "/v1/relationship/whatsapp/prep-rules") {
      const body = await deps.readBody(request);
      const prepRule = deps.createWhatsappPrepRule(body, currentUser, request);
      deps.sendJson(response, 201, { data: prepRule });
      return true;
    }

    if (method === "GET" && url.pathname === "/v1/relationship/whatsapp/evolution/status") {
      deps.sendJson(response, 200, { data: await deps.getEvolutionStatus() });
      return true;
    }

    if (method === "POST" && url.pathname === "/v1/relationship/whatsapp/evolution/instance") {
      const result = await deps.createEvolutionInstance(request, currentUser);
      deps.sendJson(response, result.ok ? 201 : 202, { data: result });
      return true;
    }

    if (method === "POST" && url.pathname === "/v1/relationship/whatsapp/evolution/connect") {
      const body = await deps.readBody(request);
      const result = await deps.connectEvolutionInstance(deps.optional(body.number));
      deps.auditWhatsapp(request, currentUser, "whatsapp.evolution_connect_requested", { id: deps.getWhatsappConfig().evolutionInstance }, { ok: result.ok, status: result.httpStatus });
      deps.sendJson(response, result.ok ? 200 : 202, { data: result });
      return true;
    }

    if (method === "GET" && url.pathname === "/v1/relationship/whatsapp/conversations") {
      deps.sendJson(response, 200, { data: deps.list("relationship_whatsapp_conversations").sort((a, b) => new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime()).slice(0, 80) });
      return true;
    }

    if (method === "GET" && url.pathname === "/v1/relationship/whatsapp/supervision") {
      deps.sendJson(response, 200, { data: deps.buildWhatsappSupervision() });
      return true;
    }

    if (method === "GET" && url.pathname === "/v1/relationship/whatsapp/exceptions") {
      deps.sendJson(response, 200, { data: deps.buildWhatsappExceptionQueue() });
      return true;
    }

    if (method === "GET" && url.pathname === "/v1/relationship/whatsapp/autonomy-reviews") {
      deps.sendJson(response, 200, { data: deps.buildWhatsappAutonomyReviews() });
      return true;
    }

    if (method === "GET" && url.pathname === "/v1/relationship/whatsapp/profile-updates") {
      deps.sendJson(response, 200, { data: deps.whatsappProfileUpdates() });
      return true;
    }

    if (method === "GET" && url.pathname === "/v1/relationship/whatsapp/consents") {
      deps.sendJson(response, 200, { data: deps.whatsappConsents() });
      return true;
    }

    if (method === "POST" && url.pathname === "/v1/relationship/whatsapp/consents/record") {
      const body = await deps.readBody(request);
      const conversation = deps.get("relationship_whatsapp_conversations", deps.optional(body.conversationId) ?? "");
      if (!conversation) return deps.sendError(response, 404, "Conversa WhatsApp nao encontrada.");
      const consent = deps.createWhatsappConsent({
        request,
        user: currentUser,
        conversation,
        message: { text: deps.optional(body.text) ?? "" },
        status: deps.optional(body.status) ?? "accepted",
        source: deps.optional(body.source) ?? "manual"
      });
      deps.sendJson(response, 201, { data: consent });
      return true;
    }

    if (method === "POST" && url.pathname === "/v1/relationship/whatsapp/profile-updates/resolve") {
      const body = await deps.readBody(request);
      const update = await deps.resolveWhatsappProfileUpdate(deps.optional(body.updateId) ?? "", deps.optional(body.status) ?? "reviewed", currentUser, request, body);
      if (!update) return deps.sendError(response, 404, "Pendencia cadastral nao encontrada.");
      if (update.errorCode) return deps.sendError(response, 400, update.errorMessage ?? "Nao foi possivel resolver a pendencia cadastral.");
      deps.sendJson(response, 200, { data: update });
      return true;
    }

    if (method === "POST" && url.pathname === "/v1/relationship/whatsapp/conversations/assume") {
      const body = await deps.readBody(request);
      const conversation = deps.assumeWhatsappConversation(deps.optional(body.conversationId) ?? "", currentUser, request);
      if (!conversation) return deps.sendError(response, 404, "Conversa WhatsApp nao encontrada.");
      deps.sendJson(response, 200, { data: conversation });
      return true;
    }

    if (method === "POST" && url.pathname === "/v1/relationship/whatsapp/conversations/release") {
      const body = await deps.readBody(request);
      const conversation = deps.releaseWhatsappConversation(deps.optional(body.conversationId) ?? "", currentUser, request);
      if (!conversation) return deps.sendError(response, 404, "Conversa WhatsApp nao encontrada.");
      deps.sendJson(response, 200, { data: conversation });
      return true;
    }

    if (method === "POST" && url.pathname === "/v1/relationship/whatsapp/conversations/resolve") {
      const body = await deps.readBody(request);
      const conversation = deps.resolveWhatsappConversation(deps.optional(body.conversationId) ?? "", currentUser, request);
      if (!conversation) return deps.sendError(response, 404, "Conversa WhatsApp nao encontrada.");
      deps.sendJson(response, 200, { data: conversation });
      return true;
    }

    if (method === "POST" && url.pathname === "/v1/relationship/whatsapp/autonomy-reviews/approve") {
      const body = await deps.readBody(request);
      const result = await deps.approveWhatsappAutonomyReview(deps.optional(body.taskId) ?? "", deps.optional(body.note) ?? "", currentUser, request);
      if (!result) return deps.sendError(response, 404, "Revisao de autonomia nao encontrada.");
      deps.sendJson(response, 200, { data: result });
      return true;
    }

    if (method === "POST" && url.pathname === "/v1/relationship/whatsapp/autonomy-reviews/reject") {
      const body = await deps.readBody(request);
      const result = deps.rejectWhatsappAutonomyReview(deps.optional(body.taskId) ?? "", deps.optional(body.note) ?? "", currentUser, request);
      if (!result) return deps.sendError(response, 404, "Revisao de autonomia nao encontrada.");
      deps.sendJson(response, 200, { data: result });
      return true;
    }

    if (method === "POST" && url.pathname === "/v1/relationship/whatsapp/messages/manual") {
      const body = await deps.readBody(request);
      const result = await deps.createManualWhatsappReply(deps.optional(body.conversationId) ?? "", deps.optional(body.text) ?? "", currentUser, request);
      if (!result) return deps.sendError(response, 404, "Conversa WhatsApp nao encontrada ou resposta vazia.");
      deps.sendJson(response, result.status === "sent" ? 201 : 202, { data: result });
      return true;
    }

    if (method === "GET" && url.pathname === "/v1/relationship/whatsapp/messages") {
      deps.sendJson(response, 200, { data: deps.list("relationship_whatsapp_messages").sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 120) });
      return true;
    }

    if (method === "GET" && url.pathname === "/v1/relationship/whatsapp/outbox") {
      deps.sendJson(response, 200, { data: deps.whatsappOutbox() });
      return true;
    }

    if (method === "POST" && url.pathname === "/v1/relationship/whatsapp/outbox/send") {
      const body = await deps.readBody(request);
      const message = deps.get("relationship_whatsapp_messages", deps.optional(body.messageId) ?? "");
      if (!message || message.direction !== "outbound") return deps.sendError(response, 404, "Mensagem de saida nao encontrada.");
      const result = await deps.sendWhatsappMessage(message, request, currentUser, { force: true });
      deps.sendJson(response, result.status === "sent" ? 200 : 202, { data: result });
      return true;
    }

    if (method === "POST" && url.pathname === "/v1/relationship/whatsapp/outbox/retry") {
      const body = await deps.readBody(request);
      const message = deps.get("relationship_whatsapp_messages", deps.optional(body.messageId) ?? "");
      if (!message || message.direction !== "outbound") return deps.sendError(response, 404, "Mensagem de saida nao encontrada.");
      const result = await deps.sendWhatsappMessage({ ...message, status: "queued" }, request, currentUser, { force: true, retry: true });
      deps.sendJson(response, result.status === "sent" ? 200 : 202, { data: result });
      return true;
    }

    if (method === "POST" && url.pathname === "/v1/relationship/whatsapp/outbox/resolve-failure") {
      const body = await deps.readBody(request);
      const message = deps.get("relationship_whatsapp_messages", deps.optional(body.messageId) ?? "");
      if (!message || message.direction !== "outbound") return deps.sendError(response, 404, "Mensagem de saida nao encontrada.");
      const resolved = deps.resolveWhatsappOutboundFailure(message, deps.optional(body.note) ?? "", request, currentUser);
      deps.sendJson(response, 200, { data: resolved });
      return true;
    }

    if (method === "POST" && url.pathname === "/v1/relationship/whatsapp/outbox/approve") {
      const body = await deps.readBody(request);
      const message = deps.get("relationship_whatsapp_messages", deps.optional(body.messageId) ?? "");
      if (!message || message.direction !== "outbound") return deps.sendError(response, 404, "Mensagem de saida nao encontrada.");
      const reviewedText = deps.optional(body.text);
      const changed = reviewedText !== undefined && reviewedText !== message.text;
      const approved = deps.updateWhatsappMessageStatus(message, {
        text: reviewedText ?? message.text,
        status: "queued",
        reviewedText: changed ? reviewedText : message.reviewedText,
        reviewedOriginalText: changed ? message.text : message.reviewedOriginalText,
        reviewedBy: changed ? currentUser.id : message.reviewedBy,
        reviewedByName: changed ? currentUser.name : message.reviewedByName,
        reviewedAt: changed ? new Date().toISOString() : message.reviewedAt,
        approvedBy: currentUser.id,
        approvedByName: currentUser.name,
        approvedAt: new Date().toISOString(),
        error: undefined
      }, request, currentUser);
      if (changed) deps.auditWhatsapp(request, currentUser, "whatsapp.outbound_reviewed", approved, { messageId: approved.id, conversationId: approved.conversationId });
      const result = await deps.sendWhatsappMessage(approved, request, currentUser, { force: true });
      deps.sendJson(response, result.status === "sent" ? 200 : 202, { data: result });
      return true;
    }

    if (method === "POST" && url.pathname === "/v1/relationship/whatsapp/outbox/send-pending") {
      const pending = deps.whatsappOutbox().filter((message) => ["queued", "failed"].includes(message.status));
      const results = [];
      for (const message of pending) {
        results.push(await deps.sendWhatsappMessage(message, request, currentUser, { force: true, retry: message.status === "failed" }));
      }
      deps.sendJson(response, 202, { data: { count: results.length, results } });
      return true;
    }

    if (method === "GET" && url.pathname === "/v1/relationship/whatsapp/tasks") {
      deps.sendJson(response, 200, { data: deps.list("relationship_whatsapp_tasks").sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 120) });
      return true;
    }

    if (method === "GET" && url.pathname === "/v1/relationship/whatsapp/ocr") {
      deps.sendJson(response, 200, { data: deps.list("relationship_whatsapp_ocr").sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 80) });
      return true;
    }

    if (method === "GET" && url.pathname === "/v1/relationship/whatsapp/audit") {
      deps.sendJson(response, 200, { data: deps.list("relationship_whatsapp_audit").sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 80) });
      return true;
    }

    if (method === "POST" && url.pathname === "/v1/relationship/whatsapp/messages/simulate") {
      const body = await deps.readBody(request);
      const result = await deps.ingestWhatsappMessage({
        provider: deps.optional(body.provider) ?? "simulation",
        externalId: deps.optional(body.externalId) ?? `sim-${Date.now()}`,
        fromPhone: deps.optional(body.fromPhone) ?? "+55 62 99999-0000",
        contactName: deps.optional(body.contactName) ?? "Paciente WhatsApp",
        messageType: deps.optional(body.messageType) ?? "text",
        text: deps.optional(body.text) ?? "",
        caption: deps.optional(body.caption),
        mediaUrl: deps.optional(body.mediaUrl),
        extractedText: deps.optional(body.extractedText)
      }, request, currentUser);
      deps.sendJson(response, 201, { data: result });
      return true;
    }

    if (method === "GET" && url.pathname === "/v1/patients/lookup") {
      const identity = deps.identifyWhatsappPatient({
        fromPhone: url.searchParams.get("phone") ?? "",
        text: url.searchParams.get("cpf") ?? ""
      });
      deps.sendJson(response, 200, {
        data: {
          found: Boolean(identity.patient),
          matchedBy: identity.matchedBy,
          identityStatus: identity.identityStatus,
          candidates: identity.candidates,
          cpfInMessage: identity.cpfInMessage,
          patient: identity.patient ? deps.publicPatientIdentity(identity.patient) : undefined
        }
      });
      return true;
    }

    if (method === "GET" && url.pathname === "/v1/appointments/availability") {
      const availability = deps.buildAppointmentAvailability({
        procedureName: url.searchParams.get("procedureName") ?? "",
        preferredDate: url.searchParams.get("preferredDate") ?? "",
        preferredPeriod: url.searchParams.get("preferredPeriod") ?? "",
        limit: Number(url.searchParams.get("limit") ?? 6)
      });
      deps.sendJson(response, 200, { data: availability });
      return true;
    }

    return false;
  }

  return { handleWebhook, handleRoute };
}
