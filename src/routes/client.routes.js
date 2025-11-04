// routes/client.routes.js
import express from "express";
import {
  addJournalEntry,
  createClient,
  deleteClient,
  deleteClientDocument,
  getAllClients,
  getAllClientsSimple,
  getClientById,
  getJournalEntries,
  updateClient,
  uploadClientDocument,
  upsertClientCommissionSettings,
} from "../controllers/client.controller.js";

import { upload } from "../middleware/multer.middleware.js";
import { verifyJWT } from "../middleware/auth.middleware.js";
import {
  addExtraContact,
  deleteExtraContact,
  editExtraContact,
  getAllExtraContacts,
} from "../controllers/extracontact.controller.js";
import { clientCommissionSummary } from "../controllers/commission.summary.controller.js";
import { verifyClientAccess } from "../middleware/teamAccess.middleware.js";

const router = express.Router();

router.post(
  "/create-client",
  verifyJWT,

  upload.array("documents"),
  createClient
);
router.get("/get-all-clients", verifyJWT, getAllClients);

router.get(
  "/get-simple-clients",
  verifyJWT,
  verifyClientAccess,
  getAllClientsSimple
);

router.patch(
  "/update-client/:clientId",
  verifyJWT,
  upload.array("documents", 5),
  verifyClientAccess,
  updateClient
);

router.delete("/delete/:clientId", verifyJWT, verifyClientAccess, deleteClient);

router.get(
  "/get-client-ById/:clientId",
  verifyJWT,
  verifyClientAccess,
  getClientById
);

router.post(
  "/upload-document/:clientId",
  verifyJWT,
  upload.single("document"),
  uploadClientDocument
);

router.delete(
  "/delete-document/:clientId/:publicId",
  verifyJWT,
  deleteClientDocument
);

router.post("/add-client-journal/:clientId", verifyJWT, addJournalEntry);

router.get("/get-client-journal/:clientId", verifyJWT, getJournalEntries);

router.post("/extra-contacts/:clientId", verifyJWT, addExtraContact);

router.put(
  "/edit-extra-contacts/:clientId/:contactId",
  verifyJWT,
  editExtraContact
);

router.delete(
  "/delete-extra-contacts/:clientId/:contactId",
  verifyJWT,
  deleteExtraContact
);

// Get all extra contacts for a specific client
router.get("/get-extra-contacts/:clientId", verifyJWT, getAllExtraContacts);

router.put(
  "/calculateCommissionSettings/:clientId",
  verifyJWT,
  upsertClientCommissionSettings
);

router.get(
  "/client-commission-summary/:clientId",
  verifyJWT,
  clientCommissionSummary
);

// router.delete(
//   "/delete-client/:clientId/journal/:journalId",
//   verifyJWT,
//   deleteJournalEntry
// );
export default router;
