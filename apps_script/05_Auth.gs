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
  }

  const expectedHeaders = ['correo', 'salt', 'password_hash', 'rol', 'area', 'created_at'];
  const lastColumn = Math.max(sheet.getLastColumn(), expectedHeaders.length);
  const headerRange = sheet.getRange(1, 1, 1, lastColumn);
  const currentHeaders = headerRange.getValues()[0];

  // Si falta la columna de área (compatibilidad hacia atrás), insertarla antes de created_at
  if (!currentHeaders.includes('area')) {
    // Insertar nueva columna en la posición 5 (antes de created_at)
    sheet.insertColumnBefore(5);
  }

  // Reescribir headers para asegurar el orden esperado
  sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);

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
  const vals = sheet.getRange(row, 1, 1, 6).getValues()[0];
  const salt = (vals[1] || '').toString();
  const storedHash = (vals[2] || '').toString();
  const role = (vals[3] || 'contribuidor').toString();
  const area = (vals[4] || '').toString();
  const hash = makeHash(password, salt);
  if (hash === storedHash) {
    return { ok: true, email: email, role: role, area: area };
  }
  return { ok: false, error: 'Credenciales inválidas' };
}

/**
 * Crea nuevo usuario
 */
function createUser(email, password, role = 'contribuidor', area = '') {
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
  const normalizedRole = (role || 'contribuidor').toString().trim().toLowerCase();
  sheet.appendRow([cleanEmail, salt, hash, normalizedRole || 'contribuidor', area || '', new Date()]);
  return { ok: true, email: cleanEmail, area: area || '', role: normalizedRole || 'contribuidor' };
}

/**
 * Lista usuarios existentes (sin exponer hashes ni salts)
 * @returns {Array<Object>} Lista de usuarios
 */
function listUsers() {
  const sheet = getCredentialsSheet();
  const values = sheet.getDataRange().getValues();
  const usuarios = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const correo = (row[0] || '').toString().trim().toLowerCase();
    if (!correo) continue;

    let createdAt = '';
    const rawDate = row[5];
    if (rawDate instanceof Date) {
      createdAt = rawDate.toISOString();
    } else if (rawDate) {
      try {
        createdAt = new Date(rawDate).toISOString();
      } catch (error) {
        createdAt = '';
      }
    }

    usuarios.push({
      email: correo,
  role: (row[3] || 'contribuidor').toString().trim().toLowerCase(),
  area: (row[4] || '').toString().trim(),
      created_at: createdAt
    });
  }

  return usuarios;
}

/**
 * Elimina un usuario existente por correo
 * @param {string} email - Correo del usuario a eliminar
 * @returns {{ok: boolean, error?: string}}
 */
function deleteUser(email) {
  const cleanEmail = (email || '').toString().trim().toLowerCase();
  if (!cleanEmail) {
    return { ok: false, error: 'Email requerido' };
  }

  const row = findUserRow(cleanEmail);
  if (row < 0) {
    return { ok: false, error: 'Usuario no encontrado' };
  }

  const sheet = getCredentialsSheet();
  const rowValues = sheet.getRange(row, 1, 1, 6).getValues()[0];
  const rolUsuario = (rowValues[3] || 'contribuidor').toString().trim().toLowerCase();

  if (rolUsuario === 'admin') {
    const data = sheet.getDataRange().getValues();
    let adminCount = 0;
    for (let i = 1; i < data.length; i++) {
      const rol = (data[i][3] || '').toString().trim().toLowerCase();
      if (rol === 'admin') {
        adminCount++;
      }
    }
    if (adminCount <= 1) {
      return { ok: false, error: 'Debe permanecer al menos un administrador activo en el sistema' };
    }
  }

  sheet.deleteRow(row);
  return { ok: true };
}

/**
 * Actualiza un usuario existente
 * @param {string} email - Correo del usuario
 * @param {Object} updates - Campos a actualizar
 * @returns {{ok: boolean, email?: string, role?: string, area?: string, passwordUpdated?: boolean, error?: string}}
 */
function updateUser(email, updates) {
  const cleanEmail = (email || '').toString().trim().toLowerCase();
  if (!cleanEmail) {
    return { ok: false, error: 'Email requerido' };
  }

  updates = updates || {};

  const row = findUserRow(cleanEmail);
  if (row < 0) {
    return { ok: false, error: 'Usuario no encontrado' };
  }

  const sheet = getCredentialsSheet();
  const currentValues = sheet.getRange(row, 1, 1, 6).getValues()[0];
  const currentRole = (currentValues[3] || 'contribuidor').toString().trim().toLowerCase();

  const requestedRole = Object.prototype.hasOwnProperty.call(updates, 'role') ? updates.role : undefined;
  let normalizedRole = currentRole;
  if (requestedRole !== undefined && requestedRole !== null) {
    const tmpRole = requestedRole.toString().trim().toLowerCase();
    normalizedRole = tmpRole || normalizedRole || 'contribuidor';
  }

  if (currentRole === 'admin' && normalizedRole !== 'admin') {
    const data = sheet.getDataRange().getValues();
    let adminCount = 0;
    for (let i = 1; i < data.length; i++) {
      const rol = (data[i][3] || '').toString().trim().toLowerCase();
      if (rol === 'admin') {
        adminCount++;
      }
    }
    if (adminCount <= 1) {
      return { ok: false, error: 'Debe permanecer al menos un administrador activo en el sistema' };
    }
  }

  let newSalt = (currentValues[1] || '').toString();
  let newHash = (currentValues[2] || '').toString();
  let passwordUpdated = false;

  const newPassword = updates.password || updates.newPassword || updates.nuevaContrasena;
  if (newPassword) {
    const passwordString = newPassword.toString();
    if (passwordString.length < 8) {
      return { ok: false, error: 'La nueva contraseña debe tener al menos 8 caracteres' };
    }
    newSalt = makeSalt(16);
    newHash = makeHash(passwordString, newSalt);
    passwordUpdated = true;
  }

  let newArea = (currentValues[4] || '').toString().trim();
  if (Object.prototype.hasOwnProperty.call(updates, 'area')) {
    newArea = (updates.area || '').toString().trim();
  }

  let createdAt = currentValues[5];
  if (!(createdAt instanceof Date)) {
    try {
      createdAt = createdAt ? new Date(createdAt) : new Date();
      if (!(createdAt instanceof Date) || isNaN(createdAt.getTime())) {
        createdAt = new Date();
      }
    } catch (error) {
      createdAt = new Date();
    }
  }

  sheet.getRange(row, 1, 1, 6).setValues([[cleanEmail, newSalt, newHash, normalizedRole || 'contribuidor', newArea || '', createdAt]]);

  return {
    ok: true,
    email: cleanEmail,
    role: normalizedRole || 'contribuidor',
    area: newArea || '',
    passwordUpdated: passwordUpdated
  };
}
