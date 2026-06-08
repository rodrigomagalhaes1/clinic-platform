export function createUraModule(deps) {
  const connectorState = {
    status: "disconnected",
    socket: null,
    connectedAt: null,
    disconnectedAt: null,
    lastEventAt: null,
    lastError: null,
    url: null
  };

  function defaultConfig() {
    return {
      id: "relationship_ura_config",
      clinicId: "clinic_demo",
      provider: "asterisk-ari",
      ariBaseUrl: "http://127.0.0.1:8088/ari",
      ariApplication: "clinic-relationship",
      ariUsername: "clinic_ari",
      ariPassword: "clinic_ari_secret",
      sipTrunk: "SIP/tronco-principal",
      inboundDid: "0800-000-0000",
      webhookSecret: "clinic-ura-local-secret",
      greetingMedia: "sound:demo-congrats",
      recordingFormat: "wav",
      autoAnswerEnabled: false,
      autoTransferEnabled: false,
      recordingEnabled: true,
      transcriptionEnabled: false,
      businessHours: "Seg-Sex 07:00-19:00; Sab 07:00-12:00",
      fallbackQueue: "human",
      status: "homologation",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function statusText(status) {
    const labels = { homologation: "Homologacao", production: "Producao", inactive: "Inativo" };
    return labels[status] ?? status ?? "nao informado";
  }

  function getConfig() {
    return { ...defaultConfig(), ...(deps.get("relationship_ura_config", "relationship_ura_config") ?? {}) };
  }

  function publicConfig(config) {
    return {
      ...config,
      ariPassword: config.ariPassword ? "" : "",
      hasAriPassword: Boolean(config.ariPassword),
      webhookSecret: config.webhookSecret ?? ""
    };
  }

  function buildConnectorStatus() {
    return {
      status: connectorState.status,
      connectedAt: connectorState.connectedAt,
      disconnectedAt: connectorState.disconnectedAt,
      lastEventAt: connectorState.lastEventAt,
      lastError: connectorState.lastError,
      url: connectorState.url,
      webhookUrl: `${deps.publicBaseUrl}/webhooks/relationship/ura/ari`,
      hasNativeWebSocket: typeof WebSocket !== "undefined"
    };
  }

  function audit(request, user, action, resource, details = {}) {
    const event = deps.create("relationship_ura_audit", {
      id: deps.id("ura_audit"),
      clinicId: deps.clinicId(request),
      userId: user.id,
      userName: user.name,
      action,
      resourceId: resource.id,
      details,
      createdAt: new Date().toISOString()
    });
    deps.logAudit(request, { user, action, resource: "relationship_ura", resourceId: resource.id, details });
    return event;
  }

  async function ariRequest(method, path) {
    const config = getConfig();
    const url = `${String(config.ariBaseUrl ?? "").replace(/\/$/, "")}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(url, {
        method,
        headers: { Authorization: ariBasicAuth(config) },
        signal: controller.signal
      });
      const text = await response.text();
      return {
        ok: response.ok,
        httpStatus: response.status,
        body: text,
        error: response.ok ? undefined : text
      };
    } finally {
      clearTimeout(timer);
    }
  }

  function commandStatusToLiveStatus(action, commandStatus, fallback) {
    if (commandStatus !== "executed") return fallback;
    const labels = { answer: "in_progress", play: "in_progress", transfer: "transferred", record: "in_progress", hangup: "completed" };
    return labels[action] ?? fallback;
  }

  async function executeAriCommand(command) {
    if (!command.channelId) return { status: "failed", error: "Canal ARI nao informado." };
    const config = getConfig();
    const encodedChannel = encodeURIComponent(command.channelId);
    const paths = {
      answer: { method: "POST", path: `/channels/${encodedChannel}/answer` },
      play: { method: "POST", path: `/channels/${encodedChannel}/play?media=${encodeURIComponent(command.media ?? config.greetingMedia ?? "sound:demo-congrats")}` },
      transfer: { method: "POST", path: `/channels/${encodedChannel}/redirect?endpoint=${encodeURIComponent(command.transferTarget ?? "PJSIP/fila-atendimento")}` },
      record: { method: "POST", path: `/channels/${encodedChannel}/record?name=${encodeURIComponent(`clinic-${command.id}`)}&format=${encodeURIComponent(config.recordingFormat ?? "wav")}&beep=false&ifExists=overwrite` },
      hangup: { method: "DELETE", path: `/channels/${encodedChannel}` }
    };
    const spec = paths[command.action];
    if (!spec) return { status: "failed", error: `Comando ARI invalido: ${command.action}` };

    try {
      const result = await ariRequest(spec.method, spec.path);
      return {
        status: result.ok ? "executed" : "failed",
        httpStatus: result.httpStatus,
        ariPath: spec.path,
        ariResponse: result.body,
        error: result.ok ? undefined : result.error ?? `ARI HTTP ${result.httpStatus}`
      };
    } catch (error) {
      return {
        status: "failed",
        ariPath: spec.path,
        error: error instanceof Error ? error.message : "Falha ao executar comando ARI."
      };
    }
  }

  async function runCommand(body, request, user) {
    const now = new Date().toISOString();
    const action = deps.optional(body.action) ?? "answer";
    const liveCall = deps.optional(body.liveCallId) ? deps.get("relationship_ura_live_calls", body.liveCallId) : undefined;
    const queue = deps.relationshipQueues.find((item) => item.id === body.queueId || item.dtmf === String(body.dtmf ?? ""));
    const channelId = deps.optional(body.channelId) ?? liveCall?.channelId;
    const command = deps.create("relationship_ura_commands", {
      id: deps.id("ura_cmd"),
      clinicId: deps.clinicId(request),
      action,
      channelId,
      liveCallId: liveCall?.id,
      media: deps.optional(body.media),
      queueId: queue?.id,
      queueName: queue?.name,
      transferTarget: deps.optional(body.transferTarget) ?? queue?.transferTarget ?? liveCall?.transferTarget,
      status: "pending",
      requestedBy: user.id,
      requestedByName: user.name,
      createdAt: now
    });

    const executed = await executeAriCommand(command);
    const saved = deps.create("relationship_ura_commands", {
      ...command,
      ...executed,
      executedAt: new Date().toISOString()
    });

    if (liveCall) {
      deps.create("relationship_ura_live_calls", {
        ...liveCall,
        status: commandStatusToLiveStatus(action, executed.status, liveCall.status),
        lastCommandId: saved.id,
        lastCommandAction: action,
        lastCommandStatus: saved.status,
        lastEventAt: saved.executedAt,
        events: [
          ...(liveCall.events ?? []),
          { type: `command_${action}`, at: saved.executedAt, actor: user.name, details: { status: saved.status, error: saved.error } }
        ]
      });
    }

    return saved;
  }

  function ariEventsUrl(config) {
    const base = String(config.ariBaseUrl ?? "").replace(/\/$/, "").replace(/^http:/, "ws:").replace(/^https:/, "wss:");
    const apiKey = `${encodeURIComponent(config.ariUsername)}:${encodeURIComponent(config.ariPassword)}`;
    return `${base}/events?api_key=${apiKey}&app=${encodeURIComponent(config.ariApplication)}`;
  }

  function ariBasicAuth(config) {
    return `Basic ${Buffer.from(`${config.ariUsername}:${config.ariPassword}`).toString("base64")}`;
  }

  function maskAriUrl(url) {
    return String(url).replace(/api_key=([^:&]+):([^&]+)/, "api_key=$1:********");
  }

  function normalizeAriProviderEvent(payload) {
    const type = String(payload.type ?? payload.eventType ?? "channel_started");
    const channel = payload.channel ?? {};
    const caller = channel.caller ?? {};
    const eventMap = {
      StasisStart: "channel_started",
      ChannelCreated: "channel_started",
      ChannelStateChange: channel.state === "Up" ? "call_answered" : "channel_started",
      ChannelDtmfReceived: "dtmf_received",
      ChannelEnteredBridge: "bridge_entered",
      BridgeEnter: "bridge_entered",
      ChannelHangupRequest: "hangup",
      ChannelDestroyed: "hangup",
      StasisEnd: "hangup"
    };
    return {
      provider: "asterisk-ari",
      eventType: eventMap[type] ?? payload.eventType ?? type,
      channelId: payload.channelId ?? channel.id ?? channel.name ?? `ARI/${Date.now()}`,
      originPhone: payload.originPhone ?? caller.number ?? caller.name,
      patientName: payload.patientName,
      dtmf: payload.dtmf ?? payload.digit,
      reason: payload.reason ?? (Array.isArray(payload.args) ? payload.args.join(" ") : payload.args),
      rawType: type,
      rawPayload: payload
    };
  }

  function normalizeFlowOption(body) {
    const queue = deps.relationshipQueues.find((item) => item.id === body.targetQueueId || item.dtmf === String(body.optionDtmf ?? ""));
    return {
      dtmf: deps.optional(body.optionDtmf) ?? queue?.dtmf ?? "1",
      label: deps.optional(body.optionLabel) ?? queue?.name ?? "Atendimento",
      targetQueueId: deps.optional(body.targetQueueId) ?? queue?.id ?? "human",
      transferTarget: deps.optional(body.transferTarget) ?? queue?.transferTarget ?? "SIP/fila-atendimento",
      message: deps.optional(body.message) ?? "Transferir chamada conforme selecao da URA."
    };
  }

  function simulateLiveCall(body, request, user) {
    const relationshipCall = deps.simulateRelationshipCall(body);
    const now = new Date().toISOString();
    const config = getConfig();
    const flow = deps.list("relationship_ura_flows").find((item) => item.status === "active")
      ?? deps.get("relationship_ura_flows", "relationship_ura_flow_main");
    const selectedOption = (flow?.options ?? []).find((option) => String(option.dtmf) === String(relationshipCall.dtmf));
    const status = relationshipCall.requiresHumanReview ? "needs_human_review" : "transferred";

    return {
      id: deps.id("ura_live"),
      clinicId: deps.clinicId(request),
      provider: config.provider,
      ariBaseUrl: config.ariBaseUrl,
      ariApplication: config.ariApplication,
      channelId: `SIP/${String(relationshipCall.originPhone).replace(/\D/g, "").slice(-8) || "canal"}-${Date.now()}`,
      originPhone: relationshipCall.originPhone,
      patientName: relationshipCall.patientName,
      dtmf: relationshipCall.dtmf,
      flowId: flow?.id,
      flowName: flow?.name,
      selectedOption,
      queueId: relationshipCall.queueId,
      queueName: relationshipCall.queueName,
      transferTarget: selectedOption?.transferTarget ?? relationshipCall.transferTarget,
      reason: relationshipCall.reason,
      intent: relationshipCall.intent,
      status,
      agentSummary: relationshipCall.agentSummary,
      agentSuggestion: relationshipCall.agentSuggestion,
      requiresHumanReview: relationshipCall.requiresHumanReview,
      recordingEnabled: config.recordingEnabled,
      transcriptionEnabled: config.transcriptionEnabled,
      events: [
        { type: "channel_started", at: now, actor: user.name, details: { provider: config.provider } },
        { type: "dtmf_received", at: now, actor: "ura", details: { digit: relationshipCall.dtmf } },
        { type: status, at: now, actor: "ura", details: { transferTarget: selectedOption?.transferTarget ?? relationshipCall.transferTarget } }
      ],
      relationshipCall,
      startedAt: now,
      lastEventAt: now
    };
  }

  function applyEventToLiveCall(call, providerEvent, now) {
    const eventDetails = {
      dtmf: providerEvent.dtmf,
      originPhone: providerEvent.originPhone,
      reason: providerEvent.reason
    };
    const nextEvents = [
      ...(call.events ?? []),
      { type: providerEvent.eventType, at: now, actor: "provider", details: eventDetails }
    ];

    if (providerEvent.eventType === "dtmf_received" && providerEvent.dtmf) {
      const queue = deps.relationshipQueues.find((item) => item.dtmf === String(providerEvent.dtmf))
        ?? deps.relationshipQueues.find((item) => item.id === getConfig().fallbackQueue)
        ?? deps.relationshipQueues[0];
      const reason = providerEvent.reason ?? call.reason ?? queue.name;
      const requiresHumanReview = queue.id === "human"
        || deps.normalizeText(reason).includes("reclamacao")
        || deps.normalizeText(reason).includes("urgente");
      return {
        ...call,
        channelId: providerEvent.channelId ?? call.channelId,
        dtmf: String(providerEvent.dtmf),
        queueId: queue.id,
        queueName: queue.name,
        transferTarget: queue.transferTarget,
        reason,
        intent: deps.inferRelationshipIntent(queue.id, reason),
        status: requiresHumanReview ? "needs_human_review" : "transferred",
        requiresHumanReview,
        agentSummary: `Evento DTMF ${providerEvent.dtmf} recebido. Direcionar para ${queue.name}.`,
        agentSuggestion: requiresHumanReview ? "Transferir para atendimento humano e registrar prioridade." : "Transferir chamada e manter rastreabilidade do canal.",
        events: nextEvents,
        lastEventAt: now
      };
    }

    const statusByEvent = {
      channel_started: "ringing",
      call_answered: "in_progress",
      bridge_entered: "in_progress",
      transfer_completed: "transferred",
      hangup: "completed"
    };

    return {
      ...call,
      channelId: providerEvent.channelId ?? call.channelId,
      originPhone: providerEvent.originPhone ?? call.originPhone,
      patientName: providerEvent.patientName ?? call.patientName,
      reason: providerEvent.reason ?? call.reason,
      status: statusByEvent[providerEvent.eventType] ?? call.status,
      events: nextEvents,
      lastEventAt: now,
      endedAt: providerEvent.eventType === "hangup" ? now : call.endedAt
    };
  }

  function ingestProviderEvent(body, request, user) {
    const now = new Date().toISOString();
    const eventType = deps.optional(body.eventType) ?? deps.optional(body.type) ?? "channel_started";
    const channelId = deps.optional(body.channelId) ?? `ARI/${Date.now()}`;
    const providerEvent = deps.create("relationship_ura_provider_events", {
      id: deps.id("ura_evt"),
      clinicId: deps.clinicId(request),
      provider: deps.optional(body.provider) ?? getConfig().provider,
      eventType,
      channelId,
      dtmf: deps.optional(body.dtmf),
      originPhone: deps.optional(body.originPhone),
      patientName: deps.optional(body.patientName),
      reason: deps.optional(body.reason),
      rawType: deps.optional(body.rawType),
      payload: body,
      receivedBy: user.id,
      receivedByName: user.name,
      receivedAt: now
    });

    const existing = deps.list("relationship_ura_live_calls").find((call) => call.channelId === channelId);
    const base = existing ?? simulateLiveCall({
      originPhone: body.originPhone,
      patientName: body.patientName,
      dtmf: body.dtmf,
      reason: body.reason
    }, request, user);
    const merged = applyEventToLiveCall(base, providerEvent, now);
    const liveCall = deps.create("relationship_ura_live_calls", merged);

    return { event: providerEvent, liveCall };
  }

  function ingestAriProviderEvent(body, request, user) {
    const normalized = normalizeAriProviderEvent(body);
    return ingestProviderEvent(normalized, request, user);
  }

  async function testConnector() {
    const config = getConfig();
    const infoUrl = `${String(config.ariBaseUrl ?? "").replace(/\/$/, "")}/asterisk/info`;
    if (!config.ariBaseUrl || !config.ariUsername || !config.ariPassword) {
      return { ok: false, status: "missing_config", message: "Configure ARI URL, usuario e senha." };
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const response = await fetch(infoUrl, {
        headers: { Authorization: ariBasicAuth(config) },
        signal: controller.signal
      });
      clearTimeout(timer);
      return {
        ok: response.ok,
        status: response.ok ? "reachable" : "http_error",
        httpStatus: response.status,
        url: infoUrl,
        message: response.ok ? "Asterisk ARI respondeu." : `ARI respondeu com HTTP ${response.status}.`
      };
    } catch (error) {
      return {
        ok: false,
        status: "unreachable",
        url: infoUrl,
        message: error instanceof Error ? error.message : "Falha ao acessar ARI."
      };
    }
  }

  function startConnector(request, user) {
    const config = getConfig();
    if (typeof WebSocket === "undefined") {
      return { ok: false, status: "unsupported", message: "Este runtime Node nao possui WebSocket nativo." };
    }
    if (!config.ariBaseUrl || !config.ariApplication || !config.ariUsername || !config.ariPassword) {
      return { ok: false, status: "missing_config", message: "Configure ARI URL, aplicacao, usuario e senha." };
    }
    if (connectorState.socket && ["connecting", "connected"].includes(connectorState.status)) {
      return buildConnectorStatus();
    }

    const url = ariEventsUrl(config);
    connectorState.status = "connecting";
    connectorState.url = maskAriUrl(url);
    connectorState.lastError = null;

    try {
      const socket = new WebSocket(url);
      connectorState.socket = socket;
      socket.addEventListener("open", () => {
        connectorState.status = "connected";
        connectorState.connectedAt = new Date().toISOString();
        connectorState.disconnectedAt = null;
        connectorState.lastError = null;
      });
      socket.addEventListener("message", (event) => {
        try {
          const payload = JSON.parse(String(event.data));
          const normalized = normalizeAriProviderEvent(payload);
          const result = ingestProviderEvent(normalized, request, deps.systemUser("Conector ARI"));
          connectorState.lastEventAt = result.event.receivedAt;
        } catch (error) {
          connectorState.lastError = error instanceof Error ? error.message : "Falha ao processar evento ARI.";
        }
      });
      socket.addEventListener("error", () => {
        connectorState.status = "error";
        connectorState.lastError = "Erro no WebSocket ARI.";
      });
      socket.addEventListener("close", () => {
        connectorState.status = "disconnected";
        connectorState.disconnectedAt = new Date().toISOString();
        connectorState.socket = null;
      });
      return { ok: true, ...buildConnectorStatus(), requestedBy: user.name };
    } catch (error) {
      connectorState.status = "error";
      connectorState.lastError = error instanceof Error ? error.message : "Falha ao conectar no ARI.";
      return { ok: false, ...buildConnectorStatus() };
    }
  }

  function stopConnector(reason = "disconnect") {
    if (connectorState.socket) {
      try {
        connectorState.socket.close(1000, reason);
      } catch {
        // Socket may already be closed by the provider.
      }
    }
    connectorState.socket = null;
    connectorState.status = "disconnected";
    connectorState.disconnectedAt = new Date().toISOString();
    return { ok: true, ...buildConnectorStatus(), reason };
  }

  function buildReadiness() {
    const config = getConfig();
    const flows = deps.list("relationship_ura_flows");
    const activeFlows = flows.filter((flow) => flow.status === "active");
    const connector = buildConnectorStatus();
    const recentLiveCalls = deps.list("relationship_ura_live_calls").filter((call) => {
      const stamp = new Date(call.lastEventAt ?? call.startedAt ?? 0).getTime();
      return Number.isFinite(stamp) && Date.now() - stamp < 24 * 60 * 60 * 1000;
    });
    const checks = [
      { id: "provider", label: "Provedor configurado", ok: Boolean(config.provider), detail: config.provider ?? "nao configurado" },
      { id: "endpoint", label: "Endpoint ARI", ok: Boolean(config.ariBaseUrl), detail: config.ariBaseUrl ?? "nao configurado" },
      { id: "application", label: "Aplicacao ARI", ok: Boolean(config.ariApplication), detail: config.ariApplication ?? "nao configurada" },
      { id: "credentials", label: "Credenciais ARI", ok: Boolean(config.ariUsername && config.ariPassword), detail: config.ariUsername ? "usuario informado" : "nao configurado" },
      { id: "trunk", label: "Tronco SIP", ok: Boolean(config.sipTrunk), detail: config.sipTrunk ?? "nao configurado" },
      { id: "flow", label: "Fluxo ativo", ok: activeFlows.length > 0, detail: `${activeFlows.length} fluxo(s) ativo(s)` },
      { id: "queues", label: "Filas de destino", ok: deps.relationshipQueues.length > 0, detail: `${deps.relationshipQueues.length} fila(s)` },
      { id: "webhook", label: "Webhook seguro", ok: Boolean(config.webhookSecret), detail: connector.webhookUrl },
      { id: "commands", label: "Comandos ARI", ok: Boolean(config.greetingMedia && config.recordingFormat), detail: `${config.greetingMedia} / ${config.recordingFormat}` },
      { id: "status", label: "Status operacional", ok: config.status !== "inactive", detail: statusText(config.status) }
    ];
    const okCount = checks.filter((check) => check.ok).length;
    const status = okCount === checks.length && config.status === "production"
      ? "production_ready"
      : okCount === checks.length
        ? "ready_for_homologation"
        : "needs_configuration";

    return {
      status,
      okCount,
      totalChecks: checks.length,
      checks,
      activeFlows: activeFlows.length,
      recentLiveCalls: recentLiveCalls.length,
      connector,
      updatedAt: new Date().toISOString()
    };
  }

  async function handleWebhook({ request, response, url, method }) {
    if (method !== "POST" || url.pathname !== "/webhooks/relationship/ura/ari") return false;

    const config = getConfig();
    const providedSecret = request.headers["x-ura-secret"] ?? url.searchParams.get("secret");
    if (!config.webhookSecret || String(providedSecret ?? "") !== String(config.webhookSecret)) {
      deps.sendError(response, 401, "Segredo do webhook invalido");
      return true;
    }

    const body = await deps.readBody(request);
    const result = ingestAriProviderEvent(body, request, deps.systemUser("Webhook ARI"));
    deps.sendJson(response, 201, { data: result });
    return true;
  }

  async function handleRoute({ request, response, url, method, currentUser }) {
    if (!url.pathname.startsWith("/v1/relationship/ura/")) return false;

    if (method === "GET" && url.pathname === "/v1/relationship/ura/config") {
      deps.sendJson(response, 200, { data: publicConfig(getConfig()) });
      return true;
    }

    if (method === "PATCH" && url.pathname === "/v1/relationship/ura/config") {
      const body = await deps.readBody(request);
      const current = getConfig();
      const updated = deps.create("relationship_ura_config", {
        ...current,
        id: "relationship_ura_config",
        clinicId: deps.clinicId(request),
        provider: deps.optional(body.provider) ?? current.provider,
        ariBaseUrl: deps.optional(body.ariBaseUrl) ?? current.ariBaseUrl,
        ariApplication: deps.optional(body.ariApplication) ?? current.ariApplication,
        ariUsername: deps.optional(body.ariUsername) ?? current.ariUsername,
        ariPassword: deps.optional(body.ariPassword) ?? current.ariPassword,
        sipTrunk: deps.optional(body.sipTrunk) ?? current.sipTrunk,
        inboundDid: deps.optional(body.inboundDid) ?? current.inboundDid,
        businessHours: deps.optional(body.businessHours) ?? current.businessHours,
        webhookSecret: deps.optional(body.webhookSecret) ?? current.webhookSecret,
        greetingMedia: deps.optional(body.greetingMedia) ?? current.greetingMedia,
        recordingFormat: deps.optional(body.recordingFormat) ?? current.recordingFormat,
        fallbackQueue: deps.optional(body.fallbackQueue) ?? current.fallbackQueue,
        autoAnswerEnabled: deps.booleanValue(body.autoAnswerEnabled, current.autoAnswerEnabled),
        autoTransferEnabled: deps.booleanValue(body.autoTransferEnabled, current.autoTransferEnabled),
        recordingEnabled: deps.booleanValue(body.recordingEnabled, current.recordingEnabled),
        transcriptionEnabled: deps.booleanValue(body.transcriptionEnabled, current.transcriptionEnabled),
        status: deps.optional(body.status) ?? current.status,
        updatedBy: currentUser.id,
        updatedByName: currentUser.name,
        updatedAt: new Date().toISOString()
      });
      audit(request, currentUser, "ura.config_updated", updated, { provider: updated.provider, status: updated.status });
      deps.sendJson(response, 200, { data: updated });
      return true;
    }

    if (method === "GET" && url.pathname === "/v1/relationship/ura/connector") {
      deps.sendJson(response, 200, { data: buildConnectorStatus() });
      return true;
    }

    if (method === "POST" && url.pathname === "/v1/relationship/ura/connector/test") {
      const result = await testConnector();
      connectorState.lastError = result.ok ? null : result.message;
      audit(request, currentUser, "ura.connector_tested", { id: "relationship_ura_connector" }, result);
      deps.sendJson(response, result.ok ? 200 : 502, { data: result });
      return true;
    }

    if (method === "POST" && url.pathname === "/v1/relationship/ura/connector/connect") {
      const result = startConnector(request, currentUser);
      audit(request, currentUser, "ura.connector_connect_requested", { id: "relationship_ura_connector" }, result);
      deps.sendJson(response, result.ok ? 200 : 400, { data: result });
      return true;
    }

    if (method === "POST" && url.pathname === "/v1/relationship/ura/connector/disconnect") {
      const result = stopConnector("manual_disconnect");
      audit(request, currentUser, "ura.connector_disconnected", { id: "relationship_ura_connector" }, result);
      deps.sendJson(response, 200, { data: result });
      return true;
    }

    if (method === "GET" && url.pathname === "/v1/relationship/ura/flows") {
      const flows = deps.list("relationship_ura_flows")
        .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
      deps.sendJson(response, 200, { data: flows });
      return true;
    }

    if (method === "POST" && url.pathname === "/v1/relationship/ura/flows") {
      const body = await deps.readBody(request);
      const now = new Date().toISOString();
      const option = normalizeFlowOption(body);
      const flow = deps.create("relationship_ura_flows", {
        id: deps.id("ura_flow"),
        clinicId: deps.clinicId(request),
        name: deps.optional(body.name) ?? "Fluxo principal",
        greetingText: deps.optional(body.greetingText) ?? "Bem-vindo. Escolha uma opcao para continuar.",
        timeoutSeconds: Number(body.timeoutSeconds || 8),
        maxRetries: Number(body.maxRetries || 2),
        options: [option],
        status: deps.optional(body.status) ?? "active",
        createdBy: currentUser.id,
        createdByName: currentUser.name,
        createdAt: now,
        updatedAt: now
      });
      audit(request, currentUser, "ura.flow_created", flow, { option });
      deps.sendJson(response, 201, { data: flow });
      return true;
    }

    if (method === "GET" && url.pathname === "/v1/relationship/ura/live") {
      const calls = deps.list("relationship_ura_live_calls")
        .sort((a, b) => new Date(b.lastEventAt ?? b.startedAt ?? 0).getTime() - new Date(a.lastEventAt ?? a.startedAt ?? 0).getTime())
        .slice(0, 60);
      deps.sendJson(response, 200, { data: calls });
      return true;
    }

    if (method === "GET" && url.pathname === "/v1/relationship/ura/readiness") {
      deps.sendJson(response, 200, { data: buildReadiness() });
      return true;
    }

    if (method === "POST" && url.pathname === "/v1/relationship/ura/live/simulate") {
      const body = await deps.readBody(request);
      const liveCall = simulateLiveCall(body, request, currentUser);
      deps.create("relationship_ura_live_calls", liveCall);
      deps.create("relationship_calls", {
        ...liveCall.relationshipCall,
        id: deps.id("call"),
        channelId: liveCall.channelId,
        liveCallId: liveCall.id
      });
      audit(request, currentUser, "ura.live_call_simulated", liveCall, { queueName: liveCall.queueName, status: liveCall.status });
      deps.sendJson(response, 201, { data: liveCall });
      return true;
    }

    if (method === "GET" && url.pathname === "/v1/relationship/ura/events") {
      const events = deps.list("relationship_ura_provider_events")
        .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())
        .slice(0, 80);
      deps.sendJson(response, 200, { data: events });
      return true;
    }

    if (method === "POST" && url.pathname === "/v1/relationship/ura/events") {
      const body = await deps.readBody(request);
      const result = ingestProviderEvent(body, request, currentUser);
      audit(request, currentUser, `ura.event_${result.event.eventType}`, result.liveCall, { channelId: result.liveCall.channelId, status: result.liveCall.status });
      deps.sendJson(response, 201, { data: result });
      return true;
    }

    if (method === "GET" && url.pathname === "/v1/relationship/ura/commands") {
      const commands = deps.list("relationship_ura_commands")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 80);
      deps.sendJson(response, 200, { data: commands });
      return true;
    }

    if (method === "POST" && url.pathname === "/v1/relationship/ura/commands") {
      const body = await deps.readBody(request);
      const command = await runCommand(body, request, currentUser);
      audit(request, currentUser, `ura.command_${command.action}`, command, { status: command.status, channelId: command.channelId });
      deps.sendJson(response, command.status === "executed" ? 201 : 502, { data: command });
      return true;
    }

    if (method === "GET" && url.pathname === "/v1/relationship/ura/audit") {
      const audit = deps.list("relationship_ura_audit")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 80);
      deps.sendJson(response, 200, { data: audit });
      return true;
    }

    return false;
  }

  return {
    defaultConfig,
    statusText,
    handleWebhook,
    handleRoute
  };
}
