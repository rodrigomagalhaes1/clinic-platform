import {
  applyAppointmentStatusTransition,
  applyAuthorizationTransition,
  buildFrontdeskSummary
} from "./appointments-frontdesk.mjs";

export function createAppointmentsModule(deps) {
  async function handleRoute({ request, response, url, method, currentUser }) {
    if (method === "GET" && url.pathname === "/v1/appointments") {
      deps.sendJson(response, 200, { data: deps.list("appointments") });
      return true;
    }

    if (method === "GET" && url.pathname === "/v1/frontdesk/summary") {
      deps.sendJson(response, 200, { data: buildFrontdeskSummary(deps.list("appointments"), deps.list("patients")) });
      return true;
    }

    if (method === "GET" && url.pathname === "/v1/appointments/notes") {
      deps.sendJson(response, 200, { data: deps.list("appointment_notes") });
      return true;
    }

    const appointmentAuditMatch = url.pathname.match(/^\/v1\/appointments\/([^/]+)\/audit$/);
    if (method === "GET" && appointmentAuditMatch) {
      const appointmentId = appointmentAuditMatch[1];
      const events = deps.list("audit_events")
        .filter((event) => event.resourceId === appointmentId || event.details?.appointmentId === appointmentId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      deps.sendJson(response, 200, { data: events });
      return true;
    }

    const appointmentUpdateMatch = url.pathname.match(/^\/v1\/appointments\/([^/]+)$/);
    if (method === "PATCH" && appointmentUpdateMatch) {
      const appointment = deps.get("appointments", appointmentUpdateMatch[1]);
      if (!appointment) {
        deps.sendJson(response, 404, { error: { code: "not_found", message: "Appointment not found" } });
        return true;
      }

      const body = await deps.readBody(request);
      const editableFields = [
        "procedureName", "roomName", "branchName", "unitName", "startsAt", "endsAt", "insuranceName", "planName",
        "memberId", "guideNumber", "guideType", "guideRequired", "authorizationStatus", "authorizationCode",
        "authorizedAt", "clinicalIndication", "cid", "requesterCrm", "requesterDoctor", "executorCrm",
        "executorDoctor", "reviewerCrm", "reviewerDoctor", "preferredDoctor", "anesthesia", "anesthetistDoctor",
        "orderSummary", "preparation", "attachmentStatus", "attendanceType", "externalSystemId", "origin",
        "requestSource", "priority", "triageColor", "chiefComplaint", "bloodPressure", "heartRate",
        "oxygenSaturation", "temperature", "companionName",
        "emergencyStage", "triageStartedAt", "triagedAt", "careStartedAt", "referredAt", "completedAt",
        "worklistStatus", "worklistPublishedAt", "laboratoryStatus", "labOrderId", "labSampleId",
        "totemTicketId", "totemCounterId", "totemCounterName", "totemCalledAt", "totemCallCount",
        "token", "tokenAbsenceReason", "operatorGuide", "mainGuide", "totemTicketNumber", "pendencySummary",
        "paymentCode", "fiscalStatus", "materialSummary", "reportPriority", "reportDeliveryMethod",
        "medicalHonoraryGroup", "medicalHonoraryType", "medicalHonoraryDueDate", "associatedProcedureSummary",
        "associatedProcedureAmount", "associatedMaterialAmount", "associatedTotalAmount", "lastMenstruationDate", "medicine",
        "procedureAmount", "materialAmount", "tissBillingDate", "tissBillingTime", "operatorCode", "contractorName",
        "requesterCbo", "attendanceCharacter", "tissAttendanceType", "tissExitType", "tissRegime", "stockName",
        "materialKit", "materialBatch", "materialQuantity", "materialBilledQuantity", "documentType",
        "documentDescription", "externalDocumentStatus", "reportStatus", "reportProtocol", "reportGroup", "reportDoctor"
      ];
      const patch = Object.fromEntries(editableFields.filter((field) => body[field] !== undefined).map((field) => [field, body[field]]));
      const procedure = patch.procedureName ? deps.findRegistryByName("registry_procedures", deps.optional(patch.procedureName)) : undefined;
      const room = patch.roomName ? deps.findRegistryByName("registry_rooms", deps.optional(patch.roomName)) : undefined;
      const insurance = patch.insuranceName ? deps.findRegistryByName("registry_insurances", deps.optional(patch.insuranceName)) : undefined;
      const nextGuideRequired = patch.guideRequired !== undefined
        ? patch.guideRequired === true || deps.normalizeText(patch.guideRequired).startsWith("sim") || String(patch.guideRequired) === "true"
        : insurance ? deps.normalizeText(insurance.guideRequired).startsWith("sim") : appointment.guideRequired;
      const updated = deps.create("appointments", {
        ...appointment,
        ...patch,
        ...(procedure ? {
          procedureName: procedure.name,
          modality: procedure.modality ?? appointment.modality,
          durationMinutes: deps.procedureDurationMinutes(procedure),
          preparation: patch.preparation ?? procedure.preparation ?? appointment.preparation
        } : {}),
        ...(room ? {
          roomName: room.name,
          equipment: room.equipment,
          branchName: patch.branchName ?? room.branch ?? appointment.branchName,
          unitName: patch.unitName ?? room.unit ?? room.unitName ?? appointment.unitName
        } : {}),
        ...(insurance ? {
          insuranceName: insurance.name,
          guideType: insurance.guideType,
          guideRequired: nextGuideRequired
        } : { guideRequired: nextGuideRequired }),
        updatedAt: new Date().toISOString()
      });
      deps.logAudit(request, { user: currentUser, action: "appointments.updated", resource: "appointments", resourceId: appointment.id, details: { fields: Object.keys(patch) } });
      deps.sendJson(response, 200, { data: updated });
      return true;
    }

    const appointmentNotesMatch = url.pathname.match(/^\/v1\/appointments\/([^/]+)\/notes$/);
    if (method === "POST" && appointmentNotesMatch) {
      const appointment = deps.get("appointments", appointmentNotesMatch[1]);
      if (!appointment) {
        deps.sendJson(response, 404, { error: { code: "not_found", message: "Appointment not found" } });
        return true;
      }

      const body = await deps.readBody(request);
      const text = deps.optional(body.text);
      if (!text) {
        deps.sendError(response, "text is required");
        return true;
      }

      const note = deps.create("appointment_notes", {
        id: deps.id("note"),
        clinicId: deps.clinicId(request),
        appointmentId: appointment.id,
        text,
        author: currentUser?.name ?? "Sistema",
        createdAt: new Date().toISOString()
      });
      deps.logAudit(request, { user: currentUser, action: "appointments.note_created", resource: "appointments", resourceId: appointment.id, details: { noteId: note.id } });
      deps.sendJson(response, 201, { data: note });
      return true;
    }

    const appointmentStatusMatch = url.pathname.match(/^\/v1\/appointments\/([^/]+)\/status$/);
    if (method === "PATCH" && appointmentStatusMatch) {
      const appointment = deps.get("appointments", appointmentStatusMatch[1]);
      if (!appointment) {
        deps.sendJson(response, 404, { error: { code: "not_found", message: "Appointment not found" } });
        return true;
      }

      const body = await deps.readBody(request);
      const allowedStatuses = new Set(["scheduled", "confirmed", "checked_in", "in_attendance", "completed", "cancelled", "no_show"]);
      const nextStatus = String(body.status ?? "");
      if (!allowedStatuses.has(nextStatus)) {
        deps.sendError(response, "Invalid appointment status");
        return true;
      }

      if (nextStatus === "cancelled") {
        const permission = ["completed", "in_attendance"].includes(appointment.status)
          ? "cancel_executed_attendance"
          : "cancel_attendance";
        deps.requirePermission(response, currentUser, permission);
        if (response.writableEnded) return true;
      }

      const transition = applyAppointmentStatusTransition(appointment, nextStatus);
      if (!transition.ok) {
        deps.sendError(response, transition.message);
        return true;
      }

      const updated = deps.create("appointments", transition.appointment);
      deps.logAudit(request, { user: currentUser, action: "appointments.status_updated", resource: "appointments", resourceId: appointment.id, details: transition.audit });
      deps.sendJson(response, 200, { data: updated });
      return true;
    }

    const appointmentAuthorizationMatch = url.pathname.match(/^\/v1\/appointments\/([^/]+)\/authorization$/);
    if (method === "PATCH" && appointmentAuthorizationMatch) {
      const appointment = deps.get("appointments", appointmentAuthorizationMatch[1]);
      if (!appointment) {
        deps.sendJson(response, 404, { error: { code: "not_found", message: "Appointment not found" } });
        return true;
      }

      const body = await deps.readBody(request);
      const allowedStatuses = new Set(["not_required", "pending", "authorized", "denied"]);
      const nextStatus = String(body.authorizationStatus ?? "authorized");

      if (!allowedStatuses.has(nextStatus)) {
        deps.sendError(response, "Invalid authorization status");
        return true;
      }

      const transition = applyAuthorizationTransition(appointment, nextStatus, {
        authorizationCode: deps.optional(body.authorizationCode) ?? appointment.authorizationCode
      });
      if (!transition.ok) {
        deps.sendError(response, transition.message);
        return true;
      }

      const updated = deps.create("appointments", transition.appointment);
      deps.logAudit(request, { user: currentUser, action: "appointments.authorization_updated", resource: "appointments", resourceId: appointment.id, details: transition.audit });
      deps.sendJson(response, 200, { data: updated });
      return true;
    }

    if (method === "POST" && url.pathname === "/v1/appointments") {
      const body = await deps.readBody(request);
      const appointmentId = deps.id("apt");
      const procedure = deps.findRegistryByName("registry_procedures", deps.optional(body.procedureName));
      const room = deps.findRegistryByName("registry_rooms", deps.optional(body.roomName));
      const insurance = deps.findRegistryByName("registry_insurances", deps.optional(body.insuranceName)) ?? deps.findRegistryByName("registry_insurances", "Particular");
      const plan = deps.findRegistryByName("registry_plans", deps.optional(body.planName));
      const insuranceName = insurance?.name ?? deps.optional(body.insuranceName) ?? "Particular";
      const guideNumber = deps.optional(body.guideNumber);
      const guideRequired = deps.normalizeText(insurance?.guideRequired).startsWith("sim");
      const authorizationStatus = deps.optional(body.authorizationStatus)
        ?? (guideRequired ? (guideNumber ? "authorized" : "pending") : "not_required");
      const durationMinutes = deps.procedureDurationMinutes(procedure);
      const startsAt = String(body.startsAt);
      const endsAt = deps.optional(body.endsAt) ?? new Date(new Date(startsAt).getTime() + durationMinutes * 60 * 1000).toISOString();
      const attendanceType = deps.optional(body.attendanceType) ?? "scheduled";
      const appointment = deps.create("appointments", {
        id: appointmentId,
        clinicId: deps.clinicId(request),
        patientId: String(body.patientId),
        professionalId: String(body.professionalId),
        branchName: deps.optional(body.branchName) ?? room?.branch ?? "Matriz",
        unitName: deps.optional(body.unitName) ?? room?.unit ?? room?.unitName ?? "Unidade principal",
        procedureName: procedure?.name ?? deps.optional(body.procedureName) ?? "Consulta",
        modality: procedure?.modality ?? room?.modality ?? deps.inferModality(deps.optional(body.procedureName), deps.optional(body.roomName)),
        durationMinutes,
        preparation: deps.optional(body.preparation) ?? procedure?.preparation ?? procedure?.prep ?? procedure?.instructions,
        insuranceName,
        memberId: deps.optional(body.memberId),
        planName: plan?.name ?? deps.optional(body.planName),
        guideNumber,
        guideRequired,
        guideType: insurance?.guideType,
        authorizationStatus,
        authorizationCode: deps.optional(body.authorizationCode) ?? guideNumber,
        accessionNumber: deps.optional(body.accessionNumber) ?? `ACC-${String(appointmentId).replace(/^apt_/, "").slice(0, 8).toUpperCase()}`,
        roomName: room?.name ?? deps.optional(body.roomName) ?? "Sala 01",
        equipment: room?.equipment,
        requesterCrm: deps.optional(body.requesterCrm),
        requesterDoctor: deps.optional(body.requesterDoctor),
        executorCrm: deps.optional(body.executorCrm),
        executorDoctor: deps.optional(body.executorDoctor),
        clinicalIndication: deps.optional(body.clinicalIndication),
        cid: deps.optional(body.cid),
        attendanceType,
        priority: deps.optional(body.priority) ?? "routine",
        triageColor: deps.optional(body.triageColor),
        chiefComplaint: deps.optional(body.chiefComplaint),
        bloodPressure: deps.optional(body.bloodPressure),
        heartRate: deps.optional(body.heartRate),
        oxygenSaturation: deps.optional(body.oxygenSaturation),
        temperature: deps.optional(body.temperature),
        emergencyStage: deps.optional(body.emergencyStage) ?? (attendanceType === "urgent_care" ? "triage_waiting" : undefined),
        orderSummary: deps.optional(body.orderSummary),
        attachmentStatus: deps.optional(body.attachmentStatus) ?? (deps.optional(body.orderSummary) ? "received" : "pending"),
        requestSource: deps.optional(body.requestSource) ?? "frontdesk",
        companionName: deps.optional(body.companionName),
        startsAt,
        endsAt,
        status: attendanceType === "urgent_care" ? "checked_in" : "scheduled",
        createdAt: new Date().toISOString()
      });
      deps.logAudit(request, { user: currentUser, action: "appointments.created", resource: "appointments", resourceId: appointment.id, details: { patientId: appointment.patientId, procedureName: appointment.procedureName, attendanceType: appointment.attendanceType } });
      deps.sendJson(response, 201, { data: appointment });
      return true;
    }

    return false;
  }

  return { handleRoute };
}
