// @ts-check
const fs = require('fs');
const path = require('path');
const config = require('../config');

const MAX_BYTES = 1.5 * 1024 * 1024;

// Parse a base64 data URI and enforce size/type constraints.
function parseBase64Image(data) {
  const uploadData = (data || '').trim();
  if (!uploadData) return null;

  const match = uploadData.match(/^data:image\/(png|jpe?g);base64,(.+)$/i);
  if (!match) {
    throw new Error('Profile photo must be a PNG or JPG.');
  }

  const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
  const buffer = Buffer.from(match[2], 'base64');

  if (!buffer.length || buffer.length > MAX_BYTES) {
    throw new Error('Profile photo is too large. Please use a smaller image.');
  }

  return { buffer, ext };
}

function ensureUploadDir() {
  if (!fs.existsSync(config.paths.uploads)) {
    fs.mkdirSync(config.paths.uploads, { recursive: true });
  }
}

function deleteIfLocal(url) {
  if (!url || !url.startsWith('/uploads/')) return;
  const target = path.join(config.paths.uploads, path.basename(url));
  fs.unlink(target, () => {});
}

function saveAvatar(userId, base64Data, previousUrl) {
  // Saves the new avatar and removes the old one if we managed it locally.
  const parsed = parseBase64Image(base64Data);
  if (!parsed) {
    return previousUrl || null;
  }

  ensureUploadDir();

  const fileName = `avatar-${userId}-${Date.now()}.${parsed.ext}`;
  const filePath = path.join(config.paths.uploads, fileName);
  fs.writeFileSync(filePath, parsed.buffer);

  deleteIfLocal(previousUrl);

  return `/uploads/${fileName}`;
}

module.exports = {
  saveAvatar
};
