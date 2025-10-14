import Event from "../models/event.model.js";
import Client from "../models/client.model.js";
import Deal from "../models/deal.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

/**
 * Helper: build start/end Date objects
 * Accepts either:
 *  - explicit ISO start & end (preferred): { start, end }
 *  - or: { date (YYYY-MM-DD), startTime (HH:mm), endTime (HH:mm), allDay (bool) }
 *
 * NOTE: This helper uses the server's Date parsing for local datetimes when date+time provided.
 * Best practice: frontend should send ISO strings (UTC) in `start` and `end`.
 */
 const buildStartEnd = ({ start, end, date, startTime, endTime, allDay }) => {
  if (start && end) return { start: new Date(start), end: new Date(end) };
  if (!date) throw new Error("Date is required");

  if (allDay) {
    const dayStart = new Date(`${date}T00:00:00Z`);
    const dayEnd = new Date(`${date}T23:59:59Z`);
    return { start: dayStart, end: dayEnd };
  }

  if (!startTime || !endTime) throw new Error("Start and end time are required for non-all-day events");

  const startDT = new Date(`${date}T${startTime}`);
  const endDT = new Date(`${date}T${endTime}`);
  return { start: startDT, end: endDT };
};

 const findConflicts = async (agentId, start, end) => {
  const Event = (await import("../models/event.model.js")).default;
  return Event.find({
    agent: agentId,
    $or: [
      { start: { $lt: end, $gte: start } },
      { end: { $gt: start, $lte: end } },
      { start: { $lte: start }, end: { $gte: end } },
    ],
  });
};

// =========================
// Create Event
// POST /api/events
// =========================

export const createEvent = asyncHandler(async (req, res) => {
  try {
    const agentId = req.user._id;

    // Accept either start+end ISO or date+times
    const { start, end, date, startTime, endTime, allDay = false } = req.body;

    // Required fields
    if (!req.body.title) throw new ApiError(400, "Title is required");
    if (!req.body.entryType) throw new ApiError(400, "entryType is required");

    // Build start / end
    let startEnd;
    try {
      startEnd = buildStartEnd({ start, end, date, startTime, endTime, allDay });
    } catch (err) {
      throw new ApiError(400, err.message);
    }
    if (startEnd.start >= startEnd.end) throw new ApiError(400, "Start time must be before end time");

    // Validate optional client (must belong to agent if provided)
    if (req.body.client) {
      const client = await Client.findById(req.body.client);
      if (!client) throw new ApiError(404, "Client not found");
      if (String(client.assignedAgent) !== String(agentId))
        throw new ApiError(403, "Client is not assigned to you");
    }

    // Validate optional deal (must belong to the agent)
    if (req.body.deal) {
      const deal = await Deal.findById(req.body.deal);
      if (!deal) throw new ApiError(404, "Deal not found");
      if (String(deal.assignedAgent || deal.agent) !== String(agentId) && String(deal.agent) !== String(agentId))
        throw new ApiError(403, "Deal is not assigned to you");
    }

    // Build event object
    const eventObj = {
      title: req.body.title,
      entryType: req.body.entryType,
      agent: agentId,
      client: req.body.client || null,
      deal: req.body.deal || null,
      start: startEnd.start,
      end: startEnd.end,
      allDay: !!allDay,
      address: req.body.address || null,
      participants: Array.isArray(req.body.participants) ? req.body.participants : (req.body.participants ? [req.body.participants] : []),
      notes: req.body.notes || null,
      followUpNotes: req.body.followUpNotes || null,
      status: req.body.status || "scheduled",
      timeZone: req.body.timeZone || null,
      color: req.body.color || null,
      metadata: req.body.metadata || {},
    };

    // Soft conflict detection (find overlapping events)
    const conflicts = await findConflicts(agentId, eventObj.start, eventObj.end);

    // Create the event (we will include conflicts information in response)
    const created = await Event.create(eventObj);

    const responsePayload = { event: created, conflicts: conflicts || [] };

    return res.status(201).json(new ApiResponse(201, responsePayload, "Event created successfully"));
  } catch (error) {
    // Let asyncHandler bubble ApiError
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, error.message || "Error creating event");
  }
});

// =========================
// Get Events in a Range (for calendar views)
// GET /api/events?start=ISO&end=ISO
// =========================

export const getEventsRange = asyncHandler(async (req, res) => {
  try {
    const agentId = req.user._id;
    const { start: startQ, end: endQ, entryType, clientId, dealId, status, limit } = req.query;

    // Validate presence and format
    if (!startQ || !endQ) {
      throw new ApiError(400, "start and end query params are required (ISO datetimes)");
    }

    const rangeStart = new Date(startQ);
    const rangeEnd = new Date(endQ);
    if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime())) {
      throw new ApiError(400, "Invalid start or end datetime");
    }
    if (rangeStart > rangeEnd) {
      throw new ApiError(400, "start must be before or equal to end");
    }

    // Build query: events that overlap the requested range
    const query = {
      agent: agentId,
      $and: [{ start: { $lte: rangeEnd } }, { end: { $gte: rangeStart } }],
    };

    if (entryType) query.entryType = entryType;
    if (clientId) query.client = clientId;
    if (dealId) query.deal = dealId;
    if (status) query.status = status;

    let dbQuery = Event.find(query)
      .sort({ start: 1 })
      .populate("client", "clientName clientEmail"); // populate client name & email for UI

    if (limit && !isNaN(parseInt(limit, 10))) {
      dbQuery = dbQuery.limit(parseInt(limit, 10));
    }

    const events = await dbQuery.lean();

    return res.status(200).json(new ApiResponse(200, events, "Events fetched successfully"));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, error.message || "Error fetching events");
  }
});

// =========================
// Get Single Event by ID
// GET /api/events/:id
// =========================
export const getEventById = asyncHandler(async (req, res) => {
  try {
    const agentId = req.user._id;
    const { id } = req.params;
    console.log("🚀 ~ id:", id)

    // Validate ID
    if (!id) throw new ApiError(400, "Event ID is required");

    // Fetch event with client and deal populated
    const event = await Event.findById(id)
      .populate("client", "clientName clientEmail")
      .populate("deal", "propertyName agreedPrice")
      .lean();

    if (!event) throw new ApiError(404, "Event not found");

    // Ownership check
    if (String(event.agent) !== String(agentId)) {
      throw new ApiError(403, "You are not authorized to view this event");
    }

    return res
      .status(200)
      .json(new ApiResponse(200, event, "Event fetched successfully"));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, error.message || "Error fetching event");
  }
});

// =========================
// Delete Event
// DELETE /api/event/delete/:id
// =========================
export const deleteEvent = asyncHandler(async (req, res) => {
  try {
    const agentId = req.user._id;
    const { id } = req.params;

    if (!id) throw new ApiError(400, "Event ID is required");

    const event = await Event.findById(id);
    if (!event) throw new ApiError(404, "Event not found");

    // Ensure event belongs to logged-in agent
    if (String(event.agent) !== String(agentId)) {
      throw new ApiError(403, "You are not authorized to delete this event");
    }

    await event.deleteOne();

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Event deleted successfully"));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, error.message || "Error deleting event");
  }
});


export const updateEvent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const agentId = req.user?._id;
  const { title, notes, address, entryType, start, end, allDay, status, color, followUpNotes } = req.body;

  // 1️⃣ Validate Event ID
  if (!id) throw new ApiError(400, "Event ID is required");

  // 2️⃣ Find event
  const event = await Event.findById(id);
  console.log("🚀 ~ event:", event)
  if (!event) throw new ApiError(404, "Event not found");

  // 3️⃣ Ownership check (use 'agent' field)
  if (event.agent?.toString() !== agentId?.toString()) {
    throw new ApiError(403, "You are not authorized to update this event");
  }

  // 4️⃣ Validate date range
  if (start && end && new Date(start) >= new Date(end)) {
    throw new ApiError(400, "Start time must be before end time");
  }

  // 5️⃣ Allowed fields
  const allowedFields = [
    "title",
    "notes",
    "address",
    "entryType",
    "start",
    "end",
    "allDay",
    "status",
    "color",
    "followUpNotes"
  ];

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      event[field] = req.body[field];
    }
  });

  // 6️⃣ Save updates
  await event.save();

  // 7️⃣ Clean response
  const responseData = {
    _id: event._id,
    title: event.title,
    entryType: event.entryType,
    address: event.address,
    start: event.start,
    end: event.end,
    allDay: event.allDay,
    notes: event.notes,
    status: event.status,
    color: event.color,
    updatedAt: event.updatedAt,
    followUpNotes: event.followUpNotes
  };

  return res
    .status(200)
    .json(new ApiResponse(200, responseData, "Event updated successfully"));
});