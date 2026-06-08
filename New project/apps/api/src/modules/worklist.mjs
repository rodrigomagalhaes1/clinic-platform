export function createWorklistModule(deps) {
  async function handleRoute({ request, response, url, method, currentUser }) {
    if (method === "GET" && url.pathname === "/v1/worklist") {
      deps.sendJson(response, 200, { data: deps.buildWorklistOrders() });
      return true;
    }

    const worklistPublishMatch = url.pathname.match(/^\/v1\/worklist\/([^/]+)\/publish$/);
    if (method === "POST" && worklistPublishMatch) {
      deps.requireAnyPermission(response, currentUser, ["restricted_hours_schedule", "lis_interface", "release_results"]);
      if (response.writableEnded) return true;

      const appointment = deps.get("appointments", worklistPublishMatch[1]);
      if (!appointment) {
        deps.sendJson(response, 404, { error: { code: "not_found", message: "Appointment not found" } });
        return true;
      }

      const publication = deps.create("worklist_publications", {
        id: appointment.id,
        appointmentId: appointment.id,
        status: "published",
        publishedAt: new Date().toISOString(),
        aeTitle: deps.inferAeTitle(appointment.roomName, appointment.procedureName)
      });
      const updatedAppointment = deps.create("appointments", {
        ...appointment,
        emergencyStage: appointment.attendanceType === "urgent_care" ? "referred_exam" : appointment.emergencyStage,
        worklistStatus: "published",
        worklistPublishedAt: publication.publishedAt,
        referredAt: appointment.attendanceType === "urgent_care" ? publication.publishedAt : appointment.referredAt,
        status: appointment.attendanceType === "urgent_care" ? "in_attendance" : appointment.status,
        updatedAt: publication.publishedAt
      });
      deps.logAudit(request, {
        user: currentUser,
        action: "appointments.worklist_published",
        resource: "appointments",
        resourceId: appointment.id,
        details: { accessionNumber: updatedAppointment.accessionNumber, aeTitle: publication.aeTitle, emergencyStage: updatedAppointment.emergencyStage }
      });
      const order = deps.buildWorklistOrder(updatedAppointment, publication);
      deps.sendJson(response, 200, { data: order });
      return true;
    }

    return false;
  }

  return { handleRoute };
}
