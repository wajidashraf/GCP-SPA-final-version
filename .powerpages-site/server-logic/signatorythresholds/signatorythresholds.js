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

function readDv(res) {
  if (res && typeof res === "object" && ("IsSuccessStatusCode" in res)) {
    if (!res.IsSuccessStatusCode) {
      let msg = res.ReasonPhrase || "Dataverse request failed";
      if (res.Body) {
        try {
          const parsed = JSON.parse(res.Body);
          if (parsed && parsed.error && parsed.error.message) {
            msg = parsed.error.message;
          }
        } catch (e) { /* body was not JSON */ }
      }
      throw new Error(msg);
    }
    if (!res.Body) return null;
    try { return JSON.parse(res.Body); } catch (e) { return res.Body; }
  }
  return res;
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
