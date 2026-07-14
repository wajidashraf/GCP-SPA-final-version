/**
 * Power Pages Server Logic: signatory members (list / add / remove).
 * Endpoint: /_api/serverlogics/signatorymembers
 * Ported from api/src/dataverse/signatories.ts (the retired Azure Function).
 *
 *   get  -> list all members        (any signed-in user)
 *   post -> add a member            (admin only; enforced in code, fail-closed)
 *   del  -> remove a member by ?id  (admin only; enforced in code, fail-closed)
 *
 * Table gcp_signatorymember1 (set: gcp_signatorymember1s).
 * gcp_group choice: 1 = prepared, 2 = confirmed; null = threshold sentinel row.
 * NOTE: gcp_sortorder does NOT exist on this table — never select/order by it.
 *
 * Connector reference: https://learn.microsoft.com/power-pages/configure/server-objects
 *   RetrieveMultipleRecords(entitySetName, options, skipCache) — EntitySetName
 *   (plural), options WITHOUT a leading "?", third arg skips the read cache.
 *
 * ⚠️ Connector response is DOUBLE-ENCODED (verified 2026-07-14 on gcp-nexus):
 *   the return value is a JSON STRING of the envelope
 *   {StatusCode, Body, IsSuccessStatusCode, ReasonPhrase, ServerError, Headers},
 *   and Body is ITSELF a JSON string of the OData payload ({value:[...]}).
 *   readDv parses the string, then recurses to unwrap Body. Missing either
 *   parse yields `.value === undefined` → an empty list with NO error.
 *
 * Return contract: JSON string { ok: true, data } on success, or
 * { ok: false, error } on failure — the client (signatoryApi.ts) unwraps it.
 */

const ENTITY_SET = "gcp_signatorymember1s";
const VALUE_GROUP = { 1: "prepared", 2: "confirmed" };

function respondOk(data) {
  return JSON.stringify({ ok: true, data: data });
}

function respondError(message) {
  return JSON.stringify({ ok: false, error: message });
}

// Safe message extraction — never re-throws if `err` is not an Error.
function errMessage(err) {
  if (err && err.message) return err.message;
  return String(err);
}

// Unwrap a Server.Connector.Dataverse response to the parsed OData payload.
// Handles the double-encoding described in the header: a JSON string of the
// {StatusCode, Body, ...} envelope whose Body is another JSON string. Also
// tolerates an object envelope (either casing) or a bare payload, in case the
// runtime shape changes. Throws on a failure status or an OData error body.
function readDv(res) {
  if (res === null || res === undefined) return res;

  // JSON-string response: parse and unwrap the result (the envelope arrives
  // as a string at runtime — recursion handles the parsed object).
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

  // An OData error body can arrive even without an explicit failure flag.
  if (payload && payload.error && payload.error.message) {
    throw new Error(payload.error.message);
  }
  return payload;
}

// Pull the row array out of a parsed payload, whatever shape it uses.
function extractRows(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.value)) return data.value;
  if (Array.isArray(data.entities)) return data.entities;
  return [];
}

function readBody() {
  const raw = Server.Context.Body;
  if (!raw) return {};
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

// Fail-closed admin check from the signed-in user's web roles.
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
  if (!isAdminUser()) {
    throw new Error("You must be an administrator to manage signatories");
  }
}

async function listMembers() {
  const options =
    "$select=gcp_signatorymember1id,gcp_name,gcp_email,gcp_group" +
    "&$orderby=gcp_group asc,gcp_name asc";
  // skipCache = true: always read fresh so a just-created row is visible.
  const data = readDv(await Server.Connector.Dataverse.RetrieveMultipleRecords(ENTITY_SET, options, true));
  const rows = extractRows(data);
  const members = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    // Coerce the choice value; only 1/2 are real groups (null = sentinel,
    // 100000000/100000001 = legacy seed values that must not display).
    const g = Number(r.gcp_group);
    if (g === 1 || g === 2) {
      members.push({
        id: r.gcp_signatorymember1id,
        group: VALUE_GROUP[g],
        name: r.gcp_name || "",
        email: r.gcp_email || "",
        sortOrder: 0
      });
    }
  }
  return members;
}

async function get() {
  try {
    return respondOk(await listMembers());
  } catch (err) {
    Server.Logger.Error("signatorymembers GET failed: " + errMessage(err));
    return respondError(errMessage(err));
  }
}

async function post() {
  try {
    requireAdmin();
    const body = readBody();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const group = String(body.group || "").trim();
    if (!name) throw new Error("Missing 'name'");
    if (!email) throw new Error("Missing 'email'");
    if (group !== "prepared" && group !== "confirmed") {
      throw new Error("'group' must be 'prepared' or 'confirmed'");
    }
    const payload = JSON.stringify({
      gcp_name: name,
      gcp_email: email,
      gcp_group: group === "prepared" ? 1 : 2
    });
    readDv(await Server.Connector.Dataverse.CreateRecord(ENTITY_SET, payload));
    return respondOk(await listMembers());
  } catch (err) {
    Server.Logger.Error("signatorymembers POST failed: " + errMessage(err));
    return respondError(errMessage(err));
  }
}

async function del() {
  try {
    requireAdmin();
    const id = String(Server.Context.QueryParameters["id"] || "").trim();
    if (!id) throw new Error("Missing record 'id'");
    readDv(await Server.Connector.Dataverse.DeleteRecord(ENTITY_SET, id));
    return respondOk(await listMembers());
  } catch (err) {
    Server.Logger.Error("signatorymembers DEL failed: " + errMessage(err));
    return respondError(errMessage(err));
  }
}

async function put() {
  return respondError("Method not supported");
}

async function patch() {
  return respondError("Method not supported");
}
