/**
 * 05_Auth.gs - Funciones de autenticación y usuarios
 */

/**
 * Abre hoja de cálculo principal
 * @returns {Spreadsheet} Objeto spreadsheet
 */
function openSheet() {
  return openSystemSpreadsheet();
}

/**
 * Obtiene hoja de credenciales
 * @returns {Sheet} Hoja de usuarios
 */
function getCredentialsSheet() {
  const ss = openSheet();
  let sheet = ss.getSheetByName(SYSTEM_CONFIG.SHEETS.USERS);
  if (!sheet) {
    sheet = ss.insertSheet(SYSTEM_CONFIG.SHEETS.USERS);
    sheet.appendRow(['correo', 'salt', 'password_hash', 'rol', 'created_at']);
  }
  return sheet;
}

/**
 * Genera salt aleatorio
 */
function makeSalt(len = 16) {
  let s = '';
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  for (let i = 0; i < len; i++) {
    s += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return s;
}

/**
 * Genera hash SHA256
 */
function sha256(text) {
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return raw.map(b => {
    const v = (b < 0) ? b + 256 : b;
    return (v < 16 ? '0' : '') + v.toString(16);
  }).join('');
}

/**
 * Genera hash de contraseña
 */
function makeHash(password, salt) {
  return sha256(password + ':' + salt);
}

/**
 * Genera token de autenticación
 */
function makeToken(email) {
  const ts = Date.now();
  const payload = email + '|' + ts;
  const signature = Utilities.computeHmacSha256Signature(payload, SYSTEM_CONFIG.SECURITY.HMAC_SECRET);
  const sigHex = signature.map(b => {
    const v = (b < 0) ? b + 256 : b;
    return (v < 16 ? '0' : '') + v.toString(16);
  }).join('');
  return Utilities.base64EncodeWebSafe(payload + '|' + sigHex);
}

/**
 * Valida token de autenticación
 */
function validateToken(token) {
  try {
    const decoded = Utilities.base64DecodeWebSafe(token);
    const decodedStr = Utilities.newBlob(decoded).getDataAsString();
    const parts = decodedStr.split('|');
    if (parts.length !== 3) {
      return { valid: false, error: 'Token format invalid' };
    }
    const email = parts[0];
    const timestamp = parseInt(parts[1]);
    const signature = parts[2];
    const now = Date.now();
    const maxAge = SYSTEM_CONFIG.SECURITY.TOKEN_EXPIRY_HOURS * 60 * 60 * 1000;
    if (now - timestamp > maxAge) {
      return { valid: false, error: 'Token expired' };
    }
    const payload = email + '|' + timestamp;
    const expectedSig = Utilities.computeHmacSha256Signature(payload, SYSTEM_CONFIG.SECURITY.HMAC_SECRET);
    const expectedSigHex = expectedSig.map(b => {
      const v = (b < 0) ? b + 256 : b;
      return (v < 16 ? '0' : '') + v.toString(16);
    }).join('');
    if (signature !== expectedSigHex) {
      return { valid: false, error: 'Invalid signature' };
    }
    return { 
      valid: true, 
      data: { email: email, timestamp: timestamp },
      message: 'Token valid'
    };
  } catch (error) {
    return { valid: false, error: 'Token validation failed: ' + error.message };
  }
}

/**
 * Busca fila de usuario por email
 */
function findUserRow(email) {
  const sheet = getCredentialsSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if ((data[i][0] || '').toString().trim().toLowerCase() === email) {
      return i + 1;
    }
  }
  return -1;
}

/**
 * Autentica usuario
 */
function loginUser(email, password) {
  const row = findUserRow(email);
  if (row < 0) {
    return { ok: false, error: 'Credenciales inválidas' };
  }
  const sheet = getCredentialsSheet();
  const vals = sheet.getRange(row, 1, 1, 5).getValues()[0];
  const salt = (vals[1] || '').toString();
  const storedHash = (vals[2] || '').toString();
  const role = (vals[3] || 'contratista').toString();
  const hash = makeHash(password, salt);
  if (hash === storedHash) {
    return { ok: true, email: email, role: role };
  }
  return { ok: false, error: 'Credenciales inválidas' };
}

/**
 * Crea nuevo usuario
 */
function createUser(email, password, role = 'contratista') {
  const cleanEmail = (email || '').toString().trim().toLowerCase();
  if (!cleanEmail || !password) {
    return { ok: false, error: 'Email y contraseña requeridos' };
  }
  if (findUserRow(cleanEmail) > 0) {
    return { ok: false, error: 'El usuario ya existe' };
  }
  const sheet = getCredentialsSheet();
  const salt = makeSalt(16);
  const hash = makeHash(password, salt);
  sheet.appendRow([cleanEmail, salt, hash, role || 'contratista', new Date()]);
  return { ok: true, email: cleanEmail };
}
