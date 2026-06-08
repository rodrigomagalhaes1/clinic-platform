const terminalStatuses = new Set(["completed", "cancelled", "no_show"]);
const statusStages = {
  scheduled: "pre_attendance",
  confirmed: "pre_attendance",
  checked_in: "arrived",
  in_attendance: "in_attendance",
  completed: "completed",
  cancelled: "cancelled",
  no_show: "no_show"
};

export function appointmentPendencies(appointment, patient) {
  const items = [];
  if (!patient?.documentNumber && !patient?.phone) items.push("ficha");
  if (appointment.insuranceName && appointment.insuranceName !== "Particular" && !appointment.memberId) items.push("carteirinha");
  if (appointment.guideRequired && !appointment.guideNumber) items.push("guia");
  if (appointment.authorizationStatus === "pending") items.push("autorizacao");
  if (appointment.authorizationStatus === "denied") items.push("autorizacao negada");
  if (!appointment.orderSummary) items.push("pedido");
  if (!appointment.roomName) items.push("sala");
  return items;
}

export function frontdeskStageForAppointment(appointment) {
  return statusStages[appointment.status] ?? "pre_attendance";
}

export function frontdeskNextAction(appointment, patient) {
  const pendencies = appointmentPendencies(appointment, patient);
  if (appointment.authorizationStatus === "denied") return "Revisar autorizacao negada";
  if (pendencies.includes("guia")) return "Solicitar guia";
  if (pendencies.includes("autorizacao")) return "Autorizar convenio";
  if (pendencies.includes("pedido")) return "Conferir pedido medico";
  if (appointment.status === "scheduled" || appointment.status === "confirmed") return "Registrar chegada";
  if (appointment.status === "checked_in") return "Encaminhar sala";
  if (appointment.status === "in_attendance") return "Concluir atendimento";
  if (appointment.status === "completed") return "Faturamento/laudo";
  if (appointment.status === "no_show") return "Reagendar ou encerrar ausencia";
  if (appointment.status === "cancelled") return "Cancelado";
  return "Acompanhar atendimento";
}

export function buildFrontdeskSummary(appointments, patients) {
  const patientById = new Map(patients.map((patient) => [patient.id, patient]));
  const rows = appointments.map((appointment) => {
    const patient = patientById.get(appointment.patientId);
    const pendencies = appointmentPendencies(appointment, patient);
    return {
      id: appointment.id,
      patientId: appointment.patientId,
      patientName: patient?.fullName ?? appointment.patientName ?? appointment.patientId,
      status: appointment.status,
      stage: frontdeskStageForAppointment(appointment),
      startsAt: appointment.startsAt,
      procedureName: appointment.procedureName,
      roomName: appointment.roomName,
      pendencies,
      nextAction: frontdeskNextAction(appointment, patient)
    };
  });
  const active = rows.filter((row) => !terminalStatuses.has(row.status));
  return {
    counts: {
      total: rows.length,
      active: active.length,
      preAttendance: active.filter((row) => row.stage === "pre_attendance").length,
      arrived: active.filter((row) => row.stage === "arrived").length,
      inAttendance: active.filter((row) => row.stage === "in_attendance").length,
      pending: active.filter((row) => row.pendencies.length > 0).length,
      completed: rows.filter((row) => row.status === "completed").length
    },
    rows: rows.sort((a, b) => new Date(a.startsAt ?? 0).getTime() - new Date(b.startsAt ?? 0).getTime())
  };
}

export function applyAppointmentStatusTransition(appointment, nextStatus, options = {}) {
  const now = options.now ?? new Date().toISOString();
  const allowedStatuses = new Set(["scheduled", "confirmed", "checked_in", "in_attendance", "completed", "cancelled", "no_show"]);
  if (!allowedStatuses.has(nextStatus)) {
    return { ok: false, message: "Invalid appointment status" };
  }

  const patch = {
    status: nextStatus,
    updatedAt: now
  };

  if (nextStatus === "checked_in") {
    patch.checkedInAt = appointment.checkedInAt ?? now;
    patch.arrivedAt = appointment.arrivedAt ?? now;
  }
  if (nextStatus === "in_attendance") {
    patch.inAttendanceAt = appointment.inAttendanceAt ?? now;
    patch.careStartedAt = appointment.careStartedAt ?? now;
  }
  if (nextStatus === "completed") {
    patch.completedAt = appointment.completedAt ?? now;
  }
  if (nextStatus === "cancelled") {
    patch.cancelledAt = appointment.cancelledAt ?? now;
  }
  if (nextStatus === "no_show") {
    patch.noShowAt = appointment.noShowAt ?? now;
  }

  return {
    ok: true,
    appointment: { ...appointment, ...patch },
    audit: { previousStatus: appointment.status, nextStatus, changedAt: now }
  };
}

export function applyAuthorizationTransition(appointment, nextStatus, options = {}) {
  const now = options.now ?? new Date().toISOString();
  const allowedStatuses = new Set(["not_required", "pending", "authorized", "denied"]);
  if (!allowedStatuses.has(nextStatus)) {
    return { ok: false, message: "Invalid authorization status" };
  }

  const patch = {
    authorizationStatus: nextStatus,
    updatedAt: now
  };

  if (options.authorizationCode) patch.authorizationCode = options.authorizationCode;
  if (nextStatus === "authorized") patch.authorizedAt = appointment.authorizedAt ?? now;
  if (nextStatus === "denied") patch.authorizationDeniedAt = appointment.authorizationDeniedAt ?? now;
  if (nextStatus === "pending") patch.authorizationRequestedAt = appointment.authorizationRequestedAt ?? now;

  return {
    ok: true,
    appointment: { ...appointment, ...patch },
    audit: { previousAuthorizationStatus: appointment.authorizationStatus, authorizationStatus: nextStatus, changedAt: now }
  };
}
