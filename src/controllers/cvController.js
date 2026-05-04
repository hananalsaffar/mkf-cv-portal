const db = require("../config/db");
const path = require("path");
const fs = require("fs");
const logAction = require("../utils/auditLogger");
const supabase = require("../config/supabase");

const {
  extractPdfText,
  extractGraduateDetailsFromText
} = require("../services/cvExtractionService");

const {
  encryptFileAtPath,
  decryptFileFromPath
} = require("../services/fileEncryptionService");

// Extract suggested graduate details from the uploaded CV
exports.extractCVDetails = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "CV file is required" });
    }

    if (!req.file.buffer) {
      return res.status(400).json({ message: "Unable to read CV file buffer" });
    }

    const rawText = await extractPdfText(req.file.buffer);
    const extractionResult = await extractGraduateDetailsFromText(rawText);

    return res.status(200).json({
      message: "CV details extracted successfully",
      extracted: extractionResult.extracted,
      source: extractionResult.source
    });
  } catch (error) {
    console.error("CV extraction error:", error);

    return res.status(500).json({
      message: error.message || "Failed to extract CV details"
    });
  }
};

// Save uploaded CV file details in the database
exports.uploadCV = async (req, res) => {
  try {
    const { graduate_id } = req.body;

    if (!graduate_id) {
      return res.status(400).json({ message: "graduate_id is required" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "CV file is required" });
    }

    const { originalname, filename, path: uploadedPath } = req.file;
    const resolvedPath = path.resolve(uploadedPath);

    // Make sure the uploaded file exists before encrypting it
    if (!fs.existsSync(resolvedPath)) {
      return res.status(400).json({
        message: "Uploaded file was not found on server"
      });
    }

    // Encrypt the file after multer saves it to disk
    const encryptionResult = encryptFileAtPath(resolvedPath);

    // Read encrypted file into memory
    const encryptedBuffer = fs.readFileSync(resolvedPath);

    // Upload encrypted file to Supabase storage (persistent)
    const { error: uploadError } = await supabase.storage
      .from("cvs")
      .upload(filename, encryptedBuffer, {
        contentType: "application/pdf",
        upsert: true
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      return res.status(500).json({ message: "Failed to upload CV to storage" });
    }

    // Delete local file after upload (no longer needed on server)
    fs.unlinkSync(resolvedPath);

    const [result] = await db.promise().query(
      `INSERT INTO cv_files (
        graduate_id,
        original_filename,
        stored_filename,
        file_path,
        encryption_iv,
        encryption_tag,
        is_encrypted
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        graduate_id,
        originalname,
        filename,
        filename,
        encryptionResult.iv,
        encryptionResult.tag,
        1
      ]
    );

    await logAction(req.user.id, "CV_UPLOAD", "cv_file", result.insertId);

    res.status(201).json({
      message: "CV uploaded successfully",
      file: {
        original_filename: originalname,
        stored_filename: filename,
        file_path: filename,
        is_encrypted: true
      }
    });
  } catch (error) {
    console.error("CV upload error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Download a CV using its database record id
exports.downloadCV = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.promise().query(
      `SELECT
          c.id,
          c.original_filename,
          c.stored_filename,
          c.file_path,
          c.encryption_iv,
          c.encryption_tag,
          c.is_encrypted,
          c.graduate_id,
          g.is_published
       FROM cv_files c
       INNER JOIN graduates g ON c.graduate_id = g.id
       WHERE c.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "CV not found" });
    }

    const cv = rows[0];

    // Partner can only access published graduates
    if (req.user.role === "partner" && !cv.is_published) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Download encrypted file from Supabase instead of local server
    const { data, error: downloadError } = await supabase.storage
      .from("cvs")
      .download(cv.stored_filename);

    if (downloadError || !data) {
      return res.status(404).json({ message: "CV file not found in storage" });
    }

    const encryptedBuffer = Buffer.from(await data.arrayBuffer());

    // Temporary file path for decryption
    const tempPath = path.join(
      __dirname,
      "..",
      "uploads",
      `temp-${cv.stored_filename}`
    );

    fs.writeFileSync(tempPath, encryptedBuffer);

    let fileBuffer;

    // Decrypt encrypted files before sending them
    if (cv.is_encrypted) {
      if (!cv.encryption_iv || !cv.encryption_tag) {
        fs.unlinkSync(tempPath);
        return res.status(500).json({ message: "Encryption metadata is missing" });
      }

      fileBuffer = decryptFileFromPath(
        tempPath,
        cv.encryption_iv,
        cv.encryption_tag
      );
    } else {
      fileBuffer = encryptedBuffer;
    }

    // Delete temporary file after use
    fs.unlinkSync(tempPath);

    await logAction(req.user.id, "CV_DOWNLOAD", "cv_file", cv.id);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${cv.original_filename}"`
    );

    return res.send(fileBuffer);
  } catch (error) {
    console.error("CV download error:", error);
    res.status(500).json({ error: error.message });
  }
};