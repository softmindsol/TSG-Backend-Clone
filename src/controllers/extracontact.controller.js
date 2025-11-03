import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import Client from "../models/client.model.js";

export const addExtraContact = asyncHandler(async (req, res) => {
  const { clientId } = req.params;
  const {
    contactType,
    name,
    companyName,
    email,
    phoneNumber,
    address,
    jobTitle,
    notes,
  } = req.body;

  if (!clientId) throw new ApiError(400, "Client ID is required");

  const client = await Client.findById(clientId);
  if (!client) throw new ApiError(404, "Client not found");

  // Check if email already exists in extraContacts
  if (email && client.extraContacts.some(contact => contact.email === email)) {
    throw new ApiError(400, "An extra contact with this email already exists");
  }

  const newContact = {
    contactType,
    name,
    companyName,
    email,
    phoneNumber,
    address,
    jobTitle,
    notes,
  };

  client.extraContacts.push(newContact);
  await client.save();

  return res.status(201).json(
    new ApiResponse(201, client.extraContacts, "Extra contact added successfully")
  );
});


export const editExtraContact = asyncHandler(async (req, res) => {
  const { clientId, contactId } = req.params;
  const updates = req.body;

  const client = await Client.findById(clientId);
  if (!client) throw new ApiError(404, "Client not found");

  const contactIndex = client.extraContacts.findIndex(
    (c) => c._id.toString() === contactId
  );
  if (contactIndex === -1) throw new ApiError(404, "Contact not found");

  client.extraContacts[contactIndex] = {
    ...client.extraContacts[contactIndex]._doc,
    ...updates,
  };

  await client.save();

  return res
    .status(200)
    .json(new ApiResponse(200, client.extraContacts, "Extra contact updated successfully"));
});


export const deleteExtraContact = asyncHandler(async (req, res) => {
  const { clientId, contactId } = req.params;

  const client = await Client.findById(clientId);
  if (!client) throw new ApiError(404, "Client not found");

  const contact = client.extraContacts.id(contactId);
  if (!contact) throw new ApiError(404, "Contact not found");

  contact.deleteOne(); // Mongoose subdoc removal
  await client.save();

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Extra contact deleted successfully"));
});

export const getAllExtraContacts = asyncHandler(async (req, res) => {
  const { clientId } = req.params;

  if (!clientId) throw new ApiError(400, "Client ID is required");

  const client = await Client.findById(clientId).select("extraContacts");
  if (!client) throw new ApiError(404, "Client not found");

  return res
    .status(200)
    .json(new ApiResponse(200, client.extraContacts, "Extra contacts fetched successfully"));
});