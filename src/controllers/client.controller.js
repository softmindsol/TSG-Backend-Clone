// controllers/client.controller.js
import Client, { COMMISSION_ENGAGEMENTS, COMMISSION_TYPES } from "../models/client.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { v2 as cloudinary } from "cloudinary";
import Deal from "../models/deal.model.js";
import Joi from "joi";
import { recomputeAllDealsForClient } from "../utils/deal.service.js";
// Function to generate unique client code
const generateClientCode = () => {
  const randomStr = Math.random().toString(36).substring(2, 8); // 6 char random string
  return `CLT-${randomStr}`;
};
const getDealPercentage = (stage) => {
  const stagePercentages = {
    Discovery: 0,
    Viewings: 16.67,
    "Offer Mode": 33.33,
    "Offer Accepted": 50,
    Exchange: 83.33,
    Completion: 100,
  };

  return stagePercentages[stage] || 0; // Default to 0% if stage is invalid
};
const upsertSettingsSchema = Joi.object({
  engagementType: Joi.string().valid(...COMMISSION_ENGAGEMENTS).required(),
  commissionType: Joi.string().valid(...COMMISSION_TYPES).required(),
  ratePct: Joi.number().min(0).when("commissionType", {
    is: "Percentage",
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
  fixedFee: Joi.number().min(0).when("commissionType", {
    is: "Fixed",
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
  currency: Joi.string().default("GBP"),
});

export const upsertClientCommissionSettings = async (req, res, next) => {
  try {
    const { error, value } = upsertSettingsSchema.validate(req.body, {
      abortEarly: false,
      convert: true,
      stripUnknown: true,
    });
    if (error) {
      throw new ApiError(400, error.details.map((d) => d.message).join(", "));
    }

    const { clientId } = req.params;
    const client = await Client.findOne({
      _id: clientId,
      assignedAgent: req.user._id, // tenancy guard
    });
    if (!client) throw new ApiError(404, "Client not found or not assigned to you");

    client.commissionSettings = { ...value, updatedAt: new Date() };
    await client.save();

    // Recompute all accepted-offer deals under this client
    const bulk = await recomputeAllDealsForClient({ clientId });

    res.status(200).json(
      new ApiResponse(200, { commissionSettings: client.commissionSettings, bulk }, "Commission settings saved"),
    );
  } catch (err) {
    next(err);
  }
};

export const createClient = asyncHandler(async (req, res) => {
  try {
    const {
      clientName,
      clientEmail,
      phoneNumber,
      clientType,
      address,
      amlStatus,
      currentPosition,
      budgetMin,
      budgetMax,
      propertyType,
      bedrooms,
      bathrooms,
      reasonForMove,
      timeFrame,
      designStyle,
      mustHaves,
      avoids,
      purchaseMethod,
      preferredLocation,
      quickNotes,
    } = req.body;

    if (!clientName || !clientEmail) {
      throw new ApiError(400, "Client name and email are required");
    }

    const existingClient = await Client.findOne({
      clientEmail: clientEmail.toLowerCase().trim(),
      assignedAgent: req.user._id,
    });

    if (existingClient) {
      throw new ApiError(409, "Client with this email already exists");
    }

    // Upload documents to Cloudinary if provided
    let uploadedDocs = [];
    if (req.files && req.files.length > 0) {
      for (let file of req.files) {
        const uploadedDoc = await uploadOnCloudinary(file.path);
        uploadedDocs.push({
          url: uploadedDoc.secure_url,
          public_id: uploadedDoc.public_id,
          filename: file.originalname,
          size: file.size,
          format: file.mimetype,
        });
      }
    }

    // 🧠 Handle mustHaves and avoids (support both array or comma-separated string)
    const parsedMustHaves = Array.isArray(mustHaves)
      ? mustHaves
      : mustHaves
      ? mustHaves.split(",").map((item) => item.trim())
      : [];

    const parsedAvoids = Array.isArray(avoids)
      ? avoids
      : avoids
      ? avoids.split(",").map((item) => item.trim())
      : [];

    const newClient = await Client.create({
      clientCode: generateClientCode(),
      clientName,
      clientEmail,
      phoneNumber,
      clientType,
      address,
      amlStatus,
      currentPosition,
      buyingPreference: {
        budget: {
          min: budgetMin || null,
          max: budgetMax || null,
        },
        propertyType: propertyType || null,
        bedrooms: bedrooms || null,
        bathrooms: bathrooms || null,
        reasonForMove: reasonForMove || null,
        timeframe: timeFrame || null,
        designStyle: designStyle || null,
        mustHaves: parsedMustHaves,
        avoids: parsedAvoids,
        purchaseMethod: purchaseMethod || null,
        preferredLocation: preferredLocation || null,
        quickNotes: quickNotes || null,
      },
      documents: uploadedDocs,
      assignedAgent: req.user._id,
    });

    return res
      .status(201)
      .json(new ApiResponse(201, newClient, "Client created successfully"));
  } catch (error) {
    throw new ApiError(500, error.message || "Error creating client");
  }
});


export const getAllClients = asyncHandler(async (req, res) => {
  // ✅ Parse and validate query params
  let { page = 1, limit = 10, search, clientType } = req.query;

  page = Math.max(1, parseInt(page) || 1);
  limit = Math.min(Math.max(1, parseInt(limit) || 10), 100); // Min 1, Max 100

  const skip = (page - 1) * limit;

  // ✅ Build query with optional filters
  const query = { assignedAgent: req.user._id };

  if (search) {
    query.$or = [
      { clientName: { $regex: search, $options: "i" } },
      { clientEmail: { $regex: search, $options: "i" } },
      { clientCode: { $regex: search, $options: "i" } },
    ];
  }

  if (clientType && ["individual", "business"].includes(clientType)) {
    query.clientType = clientType;
  }

  // ✅ Fetch clients with populated agent details
  const [clients, totalClients] = await Promise.all([
    Client.find(query)
      .select(" -metadata") // Exclude heavy fields for list view
      .populate("assignedAgent", "firstName email")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean(), // Use lean() for better performance
    Client.countDocuments(query),
  ]);

  // For each client, calculate the average deal percentage
  for (let client of clients) {
    // Fetch all deals for the client
    const deals = await Deal.find({ client: client._id }).lean();

    // Calculate the average deal percentage
    const totalPercentage = deals.reduce((acc, deal) => {
      return acc + (deal.dealTracker ? getDealPercentage(deal.dealTracker.stage) : 0);
    }, 0);
    
    const averageDealPercentage = deals.length > 0 ? totalPercentage / deals.length : 0;
    
    // Add the average percentage to the client object
    client.averageDealPercentage = averageDealPercentage;
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        clients,
        pagination: {
          total: totalClients,
          page,
          pages: Math.ceil(totalClients / limit),
          limit,
          hasMore: page * limit < totalClients,
        },
      },
      "Clients fetched successfully"
    )
  );
});

export const getAllClientsSimple = asyncHandler(async (req, res) => {
  // ✅ Only fetch clients assigned to the logged-in user
  const query = { assignedAgent: req.user._id };

  // ✅ Optional filters
  const { search } = req.query;

  if (search) {
    query.$or = [
      { clientName: { $regex: search, $options: "i" } },
      { clientEmail: { $regex: search, $options: "i" } },
      { clientCode: { $regex: search, $options: "i" } },
    ];
  }



  // ✅ Fetch only name and id (lean for performance)
  const clients = await Client.find(query)
    .select("_id clientName")
    .sort({ clientName: 1 })
    .lean();

  return res.status(200).json(
    new ApiResponse(200, { clients }, "Clients (simple list) fetched successfully")
  );
});


// update client

export const updateClient = asyncHandler(async (req, res) => {
  try {
    const { clientId } = req.params;

    // 🔍 Find client belonging to this agent
    let client = await Client.findOne({
      _id: clientId,
      assignedAgent: req.user._id,
    });

    if (!client) {
      throw new ApiError(404, "Client not found or not assigned to you");
    }

    // ✅ Update normal top-level fields
    const allowedFields = [
      "clientName",
      "clientEmail",
      "phoneNumber",
      "clientType",
      "address",
      "currentPosition",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        client[field] = req.body[field];
      }
    });

    // ✅ Update buying preferences (deep merge)
    if (req.body.buyingPreference) {
      const bp = req.body.buyingPreference;

      Object.keys(bp).forEach((key) => {
        if (bp[key] !== undefined) {
          if (key === "budget" && typeof bp[key] === "object") {
            // handle nested budget.min / budget.max
            if (bp[key].min !== undefined) {
              client.buyingPreference.budget.min = bp[key].min;
            }
            if (bp[key].max !== undefined) {
              client.buyingPreference.budget.max = bp[key].max;
            }
          }

          // 🧠 handle mustHaves & avoids (convert string -> array)
          else if (key === "mustHaves" || key === "avoids") {
            if (Array.isArray(bp[key])) {
              client.buyingPreference[key] = bp[key];
            } else if (typeof bp[key] === "string") {
              client.buyingPreference[key] = bp[key]
                .split(",")
                .map((item) => item.trim())
                .filter((item) => item.length > 0);
            } else {
              client.buyingPreference[key] = [];
            }
          }

          // all other normal fields
          else {
            client.buyingPreference[key] = bp[key];
          }
        }
      });
    }

    await client.save();

    return res
      .status(200)
      .json(new ApiResponse(200, client, "Client updated successfully"));
  } catch (error) {
    throw new ApiError(500, error.message || "Error updating client");
  }
});


export const deleteClient = asyncHandler(async (req, res) => {
  try {
    const { clientId } = req.params;

    // 🔍 Find the client and ensure it's assigned to this agent
    const client = await Client.findOne({
      _id: clientId,
      assignedAgent: req.user._id,
    });

    if (!client) {
      throw new ApiError(404, "Client not found or not assigned to you");
    }

    // ✅ Delete documents from Cloudinary
    if (client.documents && client.documents.length > 0) {
      for (const doc of client.documents) {
        try {
          await cloudinary.uploader.destroy(doc.public_id);
        } catch (err) {
          console.error(
            `❌ Error deleting file ${doc.public_id} from Cloudinary:`,
            err.message
          );
        }
      }
    }

    // ✅ Delete the client itself
    await Client.deleteOne({ _id: clientId });

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Client deleted successfully"));
  } catch (error) {
    throw new ApiError(500, error.message || "Error deleting client");
  }
});

export const getClientById = asyncHandler(async (req, res) => {
  try {
    const { clientId } = req.params;
    console.log("🚀 ~ clientId:", clientId);

    // 🔍 Find client only if assigned to this agent
    const client = await Client.findOne({
      _id: clientId,
      assignedAgent: req.user._id,
    }).populate("assignedAgent", "firstName email"); // optional: include agent info

    if (!client) {
      throw new ApiError(404, "Client not found or not assigned to you");
    }

    return res
      .status(200)
      .json(new ApiResponse(200, client, "Client fetched successfully"));
  } catch (error) {
    throw new ApiError(500, error.message || "Error fetching client details");
  }
});

export const uploadClientDocument = asyncHandler(async (req, res) => {
  try {
    const { clientId } = req.params;

    let client = await Client.findOne({
      _id: clientId,
      assignedAgent: req.user._id,
    });

    if (!client) {
      throw new ApiError(404, "Client not found or not assigned to you");
    }

    if (!req.file) {
      throw new ApiError(400, "No file uploaded");
    }

    const uploadedDoc = await uploadOnCloudinary(req.file.path);
    if (!uploadedDoc) {
      throw new ApiError(500, "Error uploading document");
    }

    const docObj = {
      url: uploadedDoc.secure_url,
      public_id: uploadedDoc.public_id,
      filename: req.file.originalname,
      size: req.file.size,
      format: req.file.mimetype,
    };

    client.documents.push(docObj);
    await client.save();

    return res
      .status(200)
      .json(new ApiResponse(200, client, "Document uploaded successfully"));
  } catch (error) {
    throw new ApiError(500, error.message || "Error uploading document");
  }
});

export const deleteClientDocument = asyncHandler(async (req, res) => {
  try {
    const { clientId, publicId } = req.params;

    let client = await Client.findOne({
      _id: clientId,
      assignedAgent: req.user._id,
    });

    if (!client) {
      throw new ApiError(404, "Client not found or not assigned to you");
    }

    // Find the document in array
    const docIndex = client.documents.findIndex(
      (doc) => doc.public_id === publicId
    );

    if (docIndex === -1) {
      throw new ApiError(404, "Document not found");
    }

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(publicId);

    // Remove from array
    client.documents.splice(docIndex, 1);

    await client.save();

    return res
      .status(200)
      .json(new ApiResponse(200, client, "Document deleted successfully"));
  } catch (error) {
    throw new ApiError(500, error.message || "Error deleting document");
  }
});

// Add journal entry

export const addJournalEntry = asyncHandler(async (req, res) => {
  try {
    const { clientId } = req.params;
    const { note, status } = req.body;

    const client = await Client.findOne({
      _id: clientId,
      assignedAgent: req.user._id,
    });

    if (!client)
      throw new ApiError(404, "Client not found or not assigned to you");

    client.journal.push({
      note,
      status: status || "General",
    });

    await client.save();

    return res
      .status(201)
      .json(
        new ApiResponse(201, client.journal, "Journal entry added successfully")
      );
  } catch (error) {
    throw new ApiError(500, error.message || "Error adding journal entry");
  }
});

export const getJournalEntries = asyncHandler(async (req, res) => {
  try {
    const { clientId } = req.params;

    const client = await Client.findOne({
      _id: clientId,
      assignedAgent: req.user._id,
    })
      .select("journal assignedAgent")
      .populate("assignedAgent", "firstName email"); // assuming 'name' field exists in User model

    if (!client) {
      throw new ApiError(404, "Client not found or not assigned to you");
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          journal: client.journal,
          assignedAgent: {
            name: client.assignedAgent?.firstName || "N/A",
            email: client.assignedAgent?.email || "N/A",
          },
        },
        "Journal fetched successfully"
      )
    );
  } catch (error) {
    throw new ApiError(500, error.message || "Error fetching journal");
  }
});

// export const deleteJournalEntry = asyncHandler(async (req, res) => {
//   try {
//     const { clientId, entryId } = req.params;

//     // First, confirm the client belongs to this agent
//     const client = await Client.findOne({
//       _id: clientId,
//       assignedAgent: req.user._id,
//     });

//     if (!client) {
//       throw new ApiError(404, "Client not found or not assigned to you");
//     }

//     // 🧩 Use $pull to remove the journal entry by ID
//     const result = await Client.updateOne(
//       { _id: clientId, assignedAgent: req.user._id },
//       { $pull: { journal: { _id: entryId } } }
//     );

//     if (result.modifiedCount === 0) {
//       throw new ApiError(404, "Journal entry not found");
//     }

//     // ✅ Return updated journal array
//     const updatedClient = await Client.findById(clientId).select("journal");

//     return res.status(200).json(
//       new ApiResponse(
//         200,
//         updatedClient.journal,
//         "Journal entry deleted successfully"
//       )
//     );
//   } catch (error) {
//     throw new ApiError(500, error.message || "Error deleting journal entry");
//   }
// });
