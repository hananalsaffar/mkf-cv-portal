const multer = require("multer");
const path = require("path");

// Store uploaded CV files on disk
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "src/uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

// Store file temporarily for extraction (no saving)
const memoryStorage = multer.memoryStorage();

// Allow only PDF files
function fileFilter(req, file, cb) {
  const fileExtension = path.extname(file.originalname).toLowerCase();

  if (file.mimetype === "application/pdf" && fileExtension === ".pdf") {
    cb(null, true);
  } else {
    cb(new Error("Only PDF files are allowed"), false);
  }
}

// Used when saving CV to server
const upload = multer({
  storage: diskStorage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

// Used when reading CV for extraction
const extractUpload = multer({
  storage: memoryStorage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

module.exports = {
  upload,
  extractUpload
};