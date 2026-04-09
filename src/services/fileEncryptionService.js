const crypto = require("crypto");
const fs = require("fs");

function getEncryptionKey() {
  const key = process.env.CV_ENCRYPTION_KEY;

  if (!key) {
    throw new Error("CV_ENCRYPTION_KEY is missing");
  }

  const keyBuffer = Buffer.from(key, "hex");

  if (keyBuffer.length !== 32) {
    throw new Error("CV_ENCRYPTION_KEY must be 64 hex characters");
  }

  return keyBuffer;
}

// Encrypt the uploaded file after it is saved on disk
function encryptFileAtPath(filePath) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);

  const fileBuffer = fs.readFileSync(filePath);

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encryptedBuffer = Buffer.concat([
    cipher.update(fileBuffer),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  fs.writeFileSync(filePath, encryptedBuffer);

  return {
    iv: iv.toString("hex"),
    tag: authTag.toString("hex")
  };
}

// Decrypt the stored file before sending it to the user
function decryptFileFromPath(filePath, ivHex, tagHex) {
  const key = getEncryptionKey();

  const encryptedBuffer = fs.readFileSync(filePath);
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(tagHex, "hex");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(encryptedBuffer),
    decipher.final()
  ]);
}

module.exports = {
  encryptFileAtPath,
  decryptFileFromPath
};