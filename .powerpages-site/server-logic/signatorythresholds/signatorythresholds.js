/**
 * Power Pages Server Logic: signature thresholds (read / set).
 * Endpoint: /_api/serverlogics/signatorythresholds
 * Ported from getThresholds/setThresholds in api/src/dataverse/signatories.ts.
 *
 *   get -> read the global thresholds (any signed-in user)
 *   put -> set the global thresholds  (admin only; enforced in code, fail-closed)
 *
 * Thresholds live on a single sentinel row of gcp_signatorymember1 whose
 * gcp_group is null, so it is excluded from the members list.
 *
 * Return contract: JSON string { ok: true, data } / { ok: false, error }.
 */

const ENTITY_SET = "gcp_signatorymember1s";
const SENTINEL_FILTER = "gcp_group eq null";

function respondOk(data) {
  return JSON.stringify({ ok: true, data: data });
}

function respondError(message) {
  return JSON.stringify({ ok: false, error: message });
}

// ⚠️ Connector response is DOUBLE-ENCODED (verified 2026-07-14, see
// signatorymembers.js): a JSON STRING of the {StatusCode, Body,
// IsSuccessStatusCode, ...} envelope whose Body is ITSELF a JSON string of
// the OData payload. Parse the string, recurse to unwrap Body. Missing either
// parse yields `.value === undefined` → empty result with NO error.
function readDv(res) {
  if (res === null || res === undefined) return res;

  if (typeof res === "string") {
    let parsedStr;
    try { parsedStr = JSON.parse(res); } catch (e) { return res; }
    return readDv(parsedStr);
  }

  if (typeof res !== "object") return res;

  // Direct access on purpose: host-marshalled objects can fail `in` checks.
  let successFlag = res.IsSuccessStatusCode;
  if (successFlag === undefined) successFlag = res.isSuccessStatusCode;

  let body = res.Body;
  if (body === undefined) body = res.body;

  if (successFlag === false) {
    let msg = res.ReasonPhrase || res.reasonPhrase || "Dataverse request failed";
    let errBody = body;
    if (typeof errBody === "string") {
      try { errBody = JSON.parse(errBody); } catch (e) { errBody = null; }
    }
    if (errBody && errBody.error && errBody.error.message) {
      msg = errBody.error.message;
    }
    throw new Error(msg);
  }

  let payload = res;
  if (body !== undefined && body !== null && body !== "") {
    payload = body;
    if (typeof payload === "string") {
      try { payload = JSON.parse(payload); } catch (e) { return payload; }
    }
  }

  if (payload && payload.error && payload.error.message) {
    throw new Error(payload.error.message);
  }
  return payload;
}

function readBody() {
  const raw = Server.Context.Body;
  if (!raw) return {};
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

function isAdminUser() {
  const u = Server.User;
  if (!u || !u.Roles) return false;
  const roles = u.Roles;
  for (let i = 0; i < roles.length; i++) {
    const r = roles[i];
    const name = typeof r === "string" ? r : (r && (r.name || r.Name));
    if (name === "Administrators") return true;
  }
  return false;
}

function requireAdmin() {
  Server.Logger.Log("signatory roles: " + JSON.stringify(Server.User ? Server.User.Roles : null));
  if (!isAdminUser()) {
    throw new Error("You must be an administrator to manage signatories");
  }
}

async function readThresholds() {
  const options =
    "$select=gcp_signatorymember1id,gcp_preparedcount,gcp_confirmcount" +
    "&$filter=" + SENTINEL_FILTER + "&$top=1";
  // skipCache = true: always read fresh (thresholds change via the admin UI).
  const data = readDv(await Server.Connector.Dataverse.RetrieveMultipleRecords(ENTITY_SET, options, true));
  const row = data && data.value && data.value.length ? data.value[0] : null;
  return {
    preparedCount: row && row.gcp_preparedcount != null ? row.gcp_preparedcount : 1,
    confirmCount: row && row.gcp_confirmcount != null ? row.gcp_confirmcount : 2
  };
}

async function get() {
  try {
    return respondOk(await readThresholds());
  } catch (err) {
    Server.Logger.Error("signatorythresholds GET failed: " + err.message);
    return respondError(err.message);
  }
}

async function put() {
  try {
    requireAdmin();
    const body = readBody();
    const preparedCount = Number(body.preparedCount);
    const confirmCount = Number(body.confirmCount);
    if (!Number.isInteger(preparedCount) || preparedCount < 1) {
      throw new Error("'preparedCount' must be a positive integer");
    }
    if (!Number.isInteger(confirmCount) || confirmCount < 1) {
      throw new Error("'confirmCount' must be a positive integer");
    }
    const findOptions =
      "$select=gcp_signatorymember1id&$filter=" + SENTINEL_FILTER + "&$top=1";
    const found = readDv(await Server.Connector.Dataverse.RetrieveMultipleRecords(ENTITY_SET, findOptions, true));
    const existing = found && found.value && found.value.length ? found.value[0] : null;
    const payload = JSON.stringify({
      gcp_preparedcount: preparedCount,
      gcp_confirmcount: confirmCount
    });
    if (existing) {
      readDv(await Server.Connector.Dataverse.UpdateRecord(ENTITY_SET, existing.gcp_signatorymember1id, payload));
    } else {
      readDv(await Server.Connector.Dataverse.CreateRecord(ENTITY_SET, payload));
    }
    return respondOk({ preparedCount: preparedCount, confirmCount: confirmCount });
  } catch (err) {
    Server.Logger.Error("signatorythresholds PUT failed: " + err.message);
    return respondError(err.message);
  }
}

async function post() {
  return respondError("Method not supported");
}

async function del() {
  return respondError("Method not supported");
}

async function patch() {
  return respondError("Method not supported");
}
