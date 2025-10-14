// middleware/upload.middleware.js
import multer from "multer";
import path from "path";
import fs from "fs";

// Use serverless-safe writable temp directory
const uploadDir = "/tmp"; // ✅ change here

// Ensure directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  }
});

export const upload = multer({ storage });
