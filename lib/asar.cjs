'use strict';
/**
 * Minimal Electron ASAR reader/writer.
 *
 * Layout of an asar file:
 *
 *   [0..4)    uint32 pickled-header size, always 4
 *   [4..8)    uint32 total header block size (= 4 + jsonBlockSize)
 *   [8..12)   uint32 json block size (= 4 + paddedJsonSize)
 *   [12..16)  uint32 unpadded JSON length
 *   [16..)    UTF-8 JSON directory tree, 4-byte aligned, then the file payloads
 *
 * Payload offsets recorded in the tree are relative to the end of the header
 * block, i.e. absolute position = 8 + totalHeaderSize + offset.
 *
 * Only enough of the format is implemented to read a text file out, swap its
 * bytes, and write a byte-identical-for-everything-else archive back.
 */

const fs = require('fs');
const crypto = require('crypto');

const PICKLE_SIZE = 4;
const INTEGRITY_BLOCK = 4 * 1024 * 1024;

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function integrityOf(buf) {
  const blocks = [];
  if (buf.length === 0) {
    blocks.push(sha256(Buffer.alloc(0)));
  } else {
    for (let pos = 0; pos < buf.length; pos += INTEGRITY_BLOCK) {
      blocks.push(sha256(buf.subarray(pos, pos + INTEGRITY_BLOCK)));
    }
  }
  return { algorithm: 'SHA256', hash: sha256(buf), blockSize: INTEGRITY_BLOCK, blocks };
}

function readHeader(raw) {
  if (raw.length < 16) throw new Error('asar: file too small to hold a header');
  if (raw.readUInt32LE(0) !== PICKLE_SIZE) throw new Error('asar: unexpected pickle size');

  const totalHeaderSize = raw.readUInt32LE(4);
  const jsonBlockSize = raw.readUInt32LE(8);
  const jsonLength = raw.readUInt32LE(12);

  if (jsonBlockSize < 4 || totalHeaderSize < jsonBlockSize) {
    throw new Error('asar: inconsistent header sizes');
  }
  if (8 + totalHeaderSize > raw.length) throw new Error('asar: header runs past end of file');
  if (jsonLength > jsonBlockSize - 4) throw new Error('asar: JSON length exceeds its block');
  if (16 + jsonLength > raw.length) throw new Error('asar: JSON runs past end of file');

  const json = JSON.parse(raw.subarray(16, 16 + jsonLength).toString('utf8'));
  return { json, totalHeaderSize, payloadStart: 8 + totalHeaderSize };
}

function safeName(name) {
  return Boolean(name) && name !== '.' && name !== '..' && !/[\\/]/.test(name);
}

/**
 * Walk the directory tree, invoking `visit(relPath, entry, inheritedUnpacked)`
 * for every file (never for directories). Directory entries carry `files`.
 */
function walkTree(root, visit) {
  (function descend(node, prefix, inheritedUnpacked) {
    if (!node || typeof node.files !== 'object' || node.files === null) {
      throw new Error('asar: directory entry without a files map');
    }
    for (const name of Object.keys(node.files)) {
      if (!safeName(name)) throw new Error('asar: unsafe path component ' + JSON.stringify(name));
      const entry = node.files[name];
      const relPath = prefix ? prefix + '/' + name : name;
      const unpacked = Boolean(inheritedUnpacked || entry.unpacked);
      if (entry.files) {
        descend(entry, relPath, unpacked);
      } else {
        visit(relPath, entry, unpacked);
      }
    }
  })(root, '', false);
}

function open(archivePath) {
  const raw = fs.readFileSync(archivePath);
  const header = readHeader(raw);

  const files = new Map();
  walkTree(header.json, (relPath, entry, unpacked) => {
    if (entry.link !== undefined) {
      files.set(relPath, { link: entry.link, unpacked });
      return;
    }
    if (!Number.isSafeInteger(entry.size) || entry.size < 0) {
      throw new Error('asar: bad size for ' + relPath);
    }
    let body = null;
    if (!unpacked) {
      const offset = Number(entry.offset);
      if (!/^\d+$/.test(String(entry.offset)) || !Number.isSafeInteger(offset)) {
        throw new Error('asar: bad offset for ' + relPath);
      }
      const start = header.payloadStart + offset;
      if (start + entry.size > raw.length) throw new Error('asar: body runs past EOF: ' + relPath);
      body = raw.subarray(start, start + entry.size);
    }
    files.set(relPath, { size: entry.size, unpacked, body });
  });

  return { raw, json: header.json, payloadStart: header.payloadStart, files };
}

function readText(archive, relPath) {
  const entry = archive.files.get(relPath);
  if (!entry) throw new Error('asar: no such file: ' + relPath);
  if (!entry.body) throw new Error('asar: file is not stored inline: ' + relPath);
  return entry.body.toString('utf8');
}

/**
 * Rebuild `archive` into `destPath`, substituting the contents of every path
 * present in `replacements` (Map<relPath, string>). All other inline files are
 * copied through with fresh offsets; directories, links and unpacked entries
 * keep their shape.
 */
function rebuild(archive, destPath, replacements) {
  const chunks = [];
  let cursor = 0;

  // Deep clone so the caller's tree is not mutated if the write fails.
  const tree = JSON.parse(JSON.stringify(archive.json));

  (function descend(node, prefix, inheritedUnpacked) {
    for (const name of Object.keys(node.files)) {
      const entry = node.files[name];
      const relPath = prefix ? prefix + '/' + name : name;
      const unpacked = Boolean(inheritedUnpacked || entry.unpacked);

      if (entry.files) {
        descend(entry, relPath, unpacked);
        continue;
      }
      if (entry.link !== undefined || unpacked) continue;
      if (!Number.isSafeInteger(entry.size) || entry.size < 0) {
        throw new Error('asar: bad size for ' + relPath);
      }

      const offset = Number(entry.offset);
      if (!/^\d+$/.test(String(entry.offset)) || !Number.isSafeInteger(offset)) {
        throw new Error('asar: bad offset for ' + relPath);
      }
      const start = archive.payloadStart + offset;
      let body = archive.raw.subarray(start, start + entry.size);

      if (replacements.has(relPath)) {
        body = Buffer.from(replacements.get(relPath), 'utf8');
        entry.size = body.length;
        entry.integrity = integrityOf(body);
      }

      entry.offset = String(cursor);
      cursor += body.length;
      chunks.push(body);
    }
  })(tree, '', false);

  const jsonBuf = Buffer.from(JSON.stringify(tree), 'utf8');
  const paddedJson = Math.ceil(jsonBuf.length / 4) * 4;
  const jsonBlockSize = 4 + paddedJson;
  const totalHeaderSize = 4 + jsonBlockSize;

  const head = Buffer.alloc(16 + paddedJson);
  head.writeUInt32LE(PICKLE_SIZE, 0);
  head.writeUInt32LE(totalHeaderSize, 4);
  head.writeUInt32LE(jsonBlockSize, 8);
  head.writeUInt32LE(jsonBuf.length, 12);
  jsonBuf.copy(head, 16);

  fs.writeFileSync(destPath, Buffer.concat([head, ...chunks]));
  return destPath;
}

/**
 * Guard rails before an archive is allowed to replace the original: same file
 * inventory, untouched files byte-identical, expected markers present.
 */
function verify(sourcePath, candidatePath, allowedPaths, markers) {
  const before = open(sourcePath);
  const after = open(candidatePath);
  const allowed = new Set(allowedPaths || []);

  if (before.files.size !== after.files.size) {
    throw new Error('verify: file count changed');
  }
  for (const [relPath, orig] of before.files) {
    const cand = after.files.get(relPath);
    if (!cand) throw new Error('verify: missing ' + relPath);
    if (orig.unpacked !== cand.unpacked || orig.link !== cand.link) {
      throw new Error('verify: layout changed for ' + relPath);
    }
    if (orig.link !== undefined || orig.unpacked) continue;
    if (cand.size !== cand.body.length || orig.size !== orig.body.length) {
      throw new Error('verify: truncated ' + relPath);
    }
    if (!allowed.has(relPath) && !orig.body.equals(cand.body)) {
      throw new Error('verify: unexpected change in ' + relPath);
    }
  }
  for (const item of markers || []) {
    const entry = after.files.get(item.file);
    if (!entry || !entry.body || !entry.body.includes(Buffer.from(item.marker, 'utf8'))) {
      throw new Error('verify: missing marker ' + JSON.stringify(item.marker) + ' in ' + item.file);
    }
  }
}

module.exports = { open, readText, rebuild, verify, integrityOf };
