import express from "express";
import { verifyJWT } from "../middleware/auth.middleware.js";
import {
  createDeal,
  deleteDeal,
  deleteDealDocument,
  getDealById,
  getDealDocuments,
  getDealsByClient,
  uploadDealDocument,
  upsertBuyerSideDetails,
  upsertConveyancingMilestones,
  upsertDealTracker,
  upsertDueDiligence,
  upsertFinancialDetails,
  upsertKeyDates,
  upsertOffer,
  upsertOptionalMilestones,
  upsertPropertyDetails,
  upsertQuickNotes,
  upsertSellerDetails,
} from "../controllers/deal.controller.js";
import { upload } from "../middleware/multer.middleware.js";

const router = express.Router();

router.post("/create-deal/:clientId", verifyJWT, createDeal);

router.get("/get-all-deal/:clientId", verifyJWT, getDealsByClient);

router.get("/get-single-deal/:dealId", verifyJWT, getDealById);

router.delete("/delete-deals/:dealId", verifyJWT, deleteDeal);

router.put("/deal-tracker/:dealId", verifyJWT, upsertDealTracker);


router.put("/key-dates/:dealId", verifyJWT, upsertKeyDates);

router.put("/buyer-side-details/:dealId", verifyJWT, upsertBuyerSideDetails);

router.put("/seller-side-details/:dealId", verifyJWT, upsertSellerDetails);

router.put("/property-details/:dealId", verifyJWT, upsertPropertyDetails);

router.put("/offers/:dealId", verifyJWT, upsertOffer);

router.put("/quickNotes/:dealId", verifyJWT, upsertQuickNotes);

router.post(
  "/upload-documents/:dealId",
  verifyJWT,
  upload.array("files"),
  uploadDealDocument
);

router.get("/get-documents/:dealId", verifyJWT, getDealDocuments);

router.delete(
  "/delete-documents/:dealId/:publicId",
  verifyJWT,
  deleteDealDocument
);

router.patch("/due-diligence/:dealId", verifyJWT, upsertDueDiligence);

router.put(
  "/conveyancing-milestones/:dealId",
  verifyJWT,
  upload.single("file"), // Handle single file upload
  upsertConveyancingMilestones
);

router.put(
  "/optional-milestones/:dealId",
  verifyJWT,
  upload.single("file"),
  upsertOptionalMilestones
);

router.patch("/financial-details/:dealId", verifyJWT, upsertFinancialDetails);



export default router;
