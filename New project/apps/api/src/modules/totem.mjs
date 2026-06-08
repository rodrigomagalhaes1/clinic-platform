export function createTotemModule(deps) {
  async function handleRoute({ request, response, url, method, currentUser }) {
    if (method === "GET" && url.pathname === "/v1/totem/queues") {
      deps.sendJson(response, 200, { data: deps.list("totem_queues").filter((queue) => queue.status !== "inactive") });
      return true;
    }

    if (method === "GET" && url.pathname === "/v1/totem/counters") {
      deps.sendJson(response, 200, { data: deps.list("totem_counters").filter((counter) => counter.status !== "inactive") });
      return true;
    }

    if (method === "GET" && url.pathname === "/v1/totem/tickets") {
      deps.sendJson(response, 200, { data: deps.list("totem_tickets").sort(sortTotemTickets) });
      return true;
    }

    if (method === "GET" && url.pathname === "/v1/totem/calls") {
      deps.sendJson(response, 200, { data: deps.list("totem_calls").sort((a, b) => new Date(b.calledAt).getTime() - new Date(a.calledAt).getTime()) });
      return true;
    }

    if (method === "GET" && url.pathname === "/v1/totem/display") {
      deps.sendJson(response, 200, { data: buildTotemDisplay() });
      return true;
    }

    if (method === "GET" && url.pathname === "/v1/totem/display-config") {
      deps.sendJson(response, 200, { data: getTotemDisplayConfig() });
      return true;
    }

    if (method === "PATCH" && url.pathname === "/v1/totem/display-config") {
      const body = await deps.readBody(request);
      const current = getTotemDisplayConfig();
      const updated = deps.create("totem_display_config", {
        ...current,
        id: "totem_display_config",
        clinicId: deps.clinicId(request),
        contentTitle: deps.optional(body.contentTitle) ?? current.contentTitle,
        contentUrl: deps.optional(body.contentUrl) ?? current.contentUrl,
        contentType: deps.optional(body.contentType) ?? current.contentType ?? "online",
        layout: deps.optional(body.layout) ?? current.layout ?? "media_left",
        updatedBy: currentUser.id,
        updatedByName: currentUser.name,
        updatedAt: new Date().toISOString()
      });
      deps.logAudit(request, { user: currentUser, action: "totem.display_config_updated", resource: "totem_display_config", resourceId: updated.id });
      deps.sendJson(response, 200, { data: updated });
      return true;
    }

    if (method === "GET" && url.pathname === "/v1/totem/audit") {
      deps.sendJson(response, 200, { data: deps.list("totem_audit").sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 80) });
      return true;
    }

    if (method === "POST" && url.pathname === "/v1/totem/tickets") {
      const body = await deps.readBody(request);
      const queue = deps.get("totem_queues", String(body.queueId));
      if (!queue) {
        deps.sendError(response, 404, "Fila do totem nao encontrada");
        return true;
      }

      const now = new Date();
      const serviceDate = now.toISOString().slice(0, 10);
      const sequence = nextTotemSequence(queue.id, serviceDate);
      const ticket = deps.create("totem_tickets", {
        id: deps.id("ticket"),
        clinicId: deps.clinicId(request),
        queueId: queue.id,
        queueName: queue.name,
        queuePrefix: queue.prefix,
        ticketNumber: `${queue.prefix}${String(sequence).padStart(3, "0")}`,
        sequence,
        serviceDate,
        patientName: deps.optional(body.patientName) ?? "Paciente",
        documentNumber: deps.optional(body.documentNumber),
        priority: normalizeTotemPriority(body.priority),
        priorityWeight: totemPriorityWeight(body.priority),
        status: "waiting",
        issuedBy: currentUser.id,
        issuedByName: currentUser.name,
        issuedAt: now.toISOString(),
        callCount: 0,
        auditTrail: []
      });
      auditTotem(request, currentUser, "totem.ticket_issued", ticket, { queueName: queue.name, priority: ticket.priority });
      deps.sendJson(response, 201, { data: ticket });
      return true;
    }

    if (method === "POST" && url.pathname === "/v1/totem/call-next") {
      const body = await deps.readBody(request);
      const counter = deps.get("totem_counters", String(body.counterId));
      if (!counter) {
        deps.sendError(response, 404, "Guiche nao encontrado");
        return true;
      }

      const ticket = nextTotemTicket(deps.optional(body.queueId));
      if (!ticket) {
        deps.sendError(response, 404, "Nao ha senhas aguardando nesta fila");
        return true;
      }

      const now = new Date().toISOString();
      const updatedTicket = deps.create("totem_tickets", {
        ...ticket,
        status: "called",
        counterId: counter.id,
        counterName: counter.name,
        calledBy: currentUser.id,
        calledByName: currentUser.name,
        calledAt: now,
        callCount: Number(ticket.callCount ?? 0) + 1,
        updatedAt: now
      });
      const call = deps.create("totem_calls", {
        id: deps.id("call"),
        clinicId: deps.clinicId(request),
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        queueId: ticket.queueId,
        queueName: ticket.queueName,
        counterId: counter.id,
        counterName: counter.name,
        patientName: ticket.patientName,
        priority: ticket.priority,
        calledBy: currentUser.id,
        calledByName: currentUser.name,
        calledAt: now,
        status: "called"
      });
      auditTotem(request, currentUser, "totem.ticket_called", updatedTicket, { counterName: counter.name });
      deps.sendJson(response, 201, { data: { ticket: updatedTicket, call, display: buildTotemDisplay() } });
      return true;
    }

    const appointmentTotemTicketMatch = url.pathname.match(/^\/v1\/appointments\/([^/]+)\/totem-ticket$/);
    if (method === "POST" && appointmentTotemTicketMatch) {
      const appointment = deps.get("appointments", appointmentTotemTicketMatch[1]);
      if (!appointment) {
        deps.sendError(response, 404, "Appointment not found");
        return true;
      }

      const body = await deps.readBody(request);
      let result;
      try {
        result = issueAppointmentTotemTicket(request, currentUser, appointment, body);
      } catch (error) {
        deps.sendError(response, error.message);
        return true;
      }
      deps.sendJson(response, 201, { data: result });
      return true;
    }

    const appointmentDisplayCallMatch = url.pathname.match(/^\/v1\/appointments\/([^/]+)\/call-display$/);
    if (method === "POST" && appointmentDisplayCallMatch) {
      const appointment = deps.get("appointments", appointmentDisplayCallMatch[1]);
      if (!appointment) {
        deps.sendError(response, 404, "Appointment not found");
        return true;
      }

      const body = await deps.readBody(request);
      const counter = deps.get("totem_counters", deps.optional(body.counterId) ?? "totem_counter_screening")
        ?? deps.list("totem_counters").find((item) => item.status !== "inactive");
      if (!counter) {
        deps.sendError(response, 404, "Guiche nao encontrado");
        return true;
      }

      const ticketResult = appointment.totemTicketId
        ? { ticket: deps.get("totem_tickets", appointment.totemTicketId), appointment }
        : (() => {
          try {
            return issueAppointmentTotemTicket(request, currentUser, appointment, body);
          } catch (error) {
            deps.sendError(response, error.message);
            return null;
          }
        })();
      if (response.writableEnded || !ticketResult) return true;
      const ticket = ticketResult.ticket;
      if (!ticket) {
        deps.sendError(response, 404, "Senha do atendimento nao encontrada");
        return true;
      }
      if (["completed", "no_show", "cancelled"].includes(ticket.status)) {
        deps.sendError(response, "Senha ja encerrada no display");
        return true;
      }

      const now = new Date().toISOString();
      const updatedTicket = deps.create("totem_tickets", {
        ...ticket,
        status: "called",
        counterId: counter.id,
        counterName: counter.name,
        calledBy: currentUser.id,
        calledByName: currentUser.name,
        calledAt: now,
        callCount: Number(ticket.callCount ?? 0) + 1,
        updatedAt: now
      });
      const call = deps.create("totem_calls", {
        id: deps.id("call"),
        clinicId: deps.clinicId(request),
        ticketId: updatedTicket.id,
        ticketNumber: updatedTicket.ticketNumber,
        queueId: updatedTicket.queueId,
        queueName: updatedTicket.queueName,
        counterId: counter.id,
        counterName: counter.name,
        patientId: updatedTicket.patientId,
        patientName: updatedTicket.patientName,
        appointmentId: appointment.id,
        priority: updatedTicket.priority,
        calledBy: currentUser.id,
        calledByName: currentUser.name,
        calledAt: now,
        status: "called"
      });
      const updatedAppointment = deps.create("appointments", {
        ...appointment,
        totemTicketId: updatedTicket.id,
        totemTicketNumber: updatedTicket.ticketNumber,
        totemCounterId: counter.id,
        totemCounterName: counter.name,
        totemCalledAt: now,
        totemCallCount: Number(appointment.totemCallCount ?? 0) + 1,
        updatedAt: now
      });
      auditTotem(request, currentUser, "totem.ticket_called", updatedTicket, { counterName: counter.name, appointmentId: appointment.id });
      deps.logAudit(request, { user: currentUser, action: "appointments.display_called", resource: "appointments", resourceId: appointment.id, details: { ticketNumber: updatedTicket.ticketNumber, counterName: counter.name } });
      deps.sendJson(response, 201, { data: { appointment: updatedAppointment, ticket: updatedTicket, call, display: buildTotemDisplay() } });
      return true;
    }

    const totemTicketStatusMatch = url.pathname.match(/^\/v1\/totem\/tickets\/([^/]+)\/status$/);
    if (method === "PATCH" && totemTicketStatusMatch) {
      const ticket = deps.get("totem_tickets", totemTicketStatusMatch[1]);
      if (!ticket) {
        deps.sendError(response, 404, "Senha nao encontrada");
        return true;
      }

      const body = await deps.readBody(request);
      const status = ["waiting", "called", "completed", "no_show", "cancelled"].includes(String(body.status))
        ? String(body.status)
        : "completed";
      const now = new Date().toISOString();
      const updated = deps.create("totem_tickets", {
        ...ticket,
        status,
        statusReason: deps.optional(body.reason),
        closedBy: ["completed", "no_show", "cancelled"].includes(status) ? currentUser.id : ticket.closedBy,
        closedByName: ["completed", "no_show", "cancelled"].includes(status) ? currentUser.name : ticket.closedByName,
        closedAt: ["completed", "no_show", "cancelled"].includes(status) ? now : ticket.closedAt,
        updatedAt: now
      });
      auditTotem(request, currentUser, `totem.ticket_${status}`, updated, { reason: deps.optional(body.reason) });
      deps.sendJson(response, 200, { data: updated });
      return true;
    }

    return false;
  }

  function nextTotemSequence(queueId, serviceDate) {
    const tickets = deps.list("totem_tickets").filter((ticket) => ticket.queueId === queueId && ticket.serviceDate === serviceDate);
    return tickets.reduce((max, ticket) => Math.max(max, Number(ticket.sequence ?? 0)), 0) + 1;
  }

  function normalizeTotemPriority(value) {
    const priority = String(value ?? "normal");
    return ["normal", "preferential", "elderly", "emergency"].includes(priority) ? priority : "normal";
  }

  function totemPriorityWeight(value) {
    const weights = { normal: 1, preferential: 2, elderly: 3, emergency: 4 };
    return weights[normalizeTotemPriority(value)] ?? 1;
  }

  function sortTotemTickets(a, b) {
    const statusOrder = { waiting: 0, called: 1, completed: 2, no_show: 3, cancelled: 4 };
    const statusDiff = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
    if (statusDiff !== 0) return statusDiff;
    const priorityDiff = Number(b.priorityWeight ?? 0) - Number(a.priorityWeight ?? 0);
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(a.issuedAt).getTime() - new Date(b.issuedAt).getTime();
  }

  function nextTotemTicket(queueId) {
    return deps.list("totem_tickets")
      .filter((ticket) => ticket.status === "waiting" && (!queueId || ticket.queueId === queueId))
      .sort(sortTotemTickets)[0];
  }

  function issueAppointmentTotemTicket(request, currentUser, appointment, body = {}) {
    const existing = appointment.totemTicketId ? deps.get("totem_tickets", appointment.totemTicketId) : undefined;
    if (existing && !["cancelled", "completed", "no_show"].includes(existing.status)) {
      return { appointment, ticket: existing, reused: true };
    }

    const queue = deps.get("totem_queues", deps.optional(body.queueId) ?? defaultTotemQueueIdForAppointment(appointment))
      ?? deps.list("totem_queues").find((item) => item.status !== "inactive");
    if (!queue) throw new Error("Fila do totem nao encontrada");

    const patient = deps.get("patients", appointment.patientId);
    const now = new Date();
    const serviceDate = now.toISOString().slice(0, 10);
    const sequence = nextTotemSequence(queue.id, serviceDate);
    const ticket = deps.create("totem_tickets", {
      id: deps.id("ticket"),
      clinicId: deps.clinicId(request),
      queueId: queue.id,
      queueName: queue.name,
      queuePrefix: queue.prefix,
      ticketNumber: `${queue.prefix}${String(sequence).padStart(3, "0")}`,
      sequence,
      serviceDate,
      patientId: appointment.patientId,
      patientName: patient?.fullName ?? appointment.patientName ?? "Paciente",
      documentNumber: patient?.documentNumber ?? appointment.documentNumber,
      appointmentId: appointment.id,
      source: appointment.attendanceType === "urgent_care" ? "pronto_atendimento" : "atendimento",
      emergencyStage: appointment.emergencyStage,
      priority: normalizeTotemPriority(body.priority ?? totemPriorityFromAppointment(appointment)),
      priorityWeight: totemPriorityWeight(body.priority ?? totemPriorityFromAppointment(appointment)),
      status: "waiting",
      issuedBy: currentUser.id,
      issuedByName: currentUser.name,
      issuedAt: now.toISOString(),
      callCount: 0,
      auditTrail: []
    });
    const updatedAppointment = deps.create("appointments", {
      ...appointment,
      totemTicketId: ticket.id,
      totemTicketNumber: ticket.ticketNumber,
      updatedAt: now.toISOString()
    });
    auditTotem(request, currentUser, "totem.ticket_issued", ticket, { queueName: queue.name, priority: ticket.priority, appointmentId: appointment.id });
    deps.logAudit(request, { user: currentUser, action: "appointments.totem_ticket_issued", resource: "appointments", resourceId: appointment.id, details: { ticketNumber: ticket.ticketNumber, queueName: queue.name } });
    return { appointment: updatedAppointment, ticket, reused: false };
  }

  function defaultTotemQueueIdForAppointment(appointment) {
    if (["urgent", "emergency"].includes(appointment.priority)) return "totem_queue_priority";
    return appointment.attendanceType === "urgent_care" ? "totem_queue_priority" : "totem_queue_reception";
  }

  function totemPriorityFromAppointment(appointment) {
    const priority = String(appointment.priority ?? "");
    if (priority === "emergency" || priority === "urgent") return "emergency";
    if (priority === "priority") return "preferential";
    return "normal";
  }

  function buildTotemDisplay() {
    const calls = deps.list("totem_calls").sort((a, b) => new Date(b.calledAt).getTime() - new Date(a.calledAt).getTime());
    const waiting = deps.list("totem_tickets").filter((ticket) => ticket.status === "waiting");
    const queues = deps.list("totem_queues").filter((queue) => queue.status !== "inactive");
    return {
      currentCall: calls[0] ?? null,
      recentCalls: calls.slice(0, 8),
      waitingTotal: waiting.length,
      waitingByQueue: queues.map((queue) => ({
        queueId: queue.id,
        queueName: queue.name,
        prefix: queue.prefix,
        waiting: waiting.filter((ticket) => ticket.queueId === queue.id).length,
        priorityWaiting: waiting.filter((ticket) => ticket.queueId === queue.id && Number(ticket.priorityWeight ?? 0) > 1).length
      })),
      updatedAt: new Date().toISOString()
    };
  }

  function getTotemDisplayConfig() {
    return deps.get("totem_display_config", "totem_display_config") ?? {
      id: "totem_display_config",
      clinicId: "clinic_demo",
      contentTitle: "Conteudo institucional",
      contentUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      contentType: "online",
      layout: "media_left",
      createdAt: new Date().toISOString()
    };
  }

  function auditTotem(request, user, action, ticket, details = {}) {
    const event = {
      id: deps.id("totemaud"),
      clinicId: user.clinicId ?? deps.clinicId(request),
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      queueId: ticket.queueId,
      queueName: ticket.queueName,
      patientName: ticket.patientName,
      action,
      status: ticket.status,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      details,
      createdAt: new Date().toISOString()
    };
    deps.create("totem_audit", event);
    deps.logAudit(request, { user, action, resource: "totem_tickets", resourceId: ticket.id, details });
    return event;
  }

  return { handleRoute };
}
