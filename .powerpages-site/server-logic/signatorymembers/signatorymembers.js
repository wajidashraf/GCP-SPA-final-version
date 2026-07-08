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

// Unwrap a Server.Connector.Dataverse response; throw on a non-2xx status,
// surfacing the OData error message when present.
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
  Server.Logger.Log("signatory roles: " + JSON.stringify(Server.User ? Server.User.Roles : null));
  if (!isAdminUser()) {
    throw new Error("You must be an administrator to manage signatories");
  }
}

async function listMembers() {
  const options =
    "$select=gcp_signatorymember1id,gcp_name,gcp_email,gcp_group,gcp_sortorder" +
    "&$orderby=gcp_group asc,gcp_sortorder asc,gcp_name asc";
  const data = readDv(await Server.Connector.Dataverse.RetrieveMultipleRecords(ENTITY_SET, options));
  const rows = data && data.value ? data.value : [];
  const members = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.gcp_group === 1 || r.gcp_group === 2) {
      members.push({
        id: r.gcp_signatorymember1id,
        group: VALUE_GROUP[r.gcp_group],
        name: r.gcp_name || "",
        email: r.gcp_email || "",
        sortOrder: r.gcp_sortorder || 0
      });
    }
  }
  return members;
}

async function get() {
  try {
    return respondOk(await listMembers());
  } catch (err) {
    Server.Logger.Error("signatorymembers GET failed: " + err.message);
    return respondError(err.message);
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
      gcp_group: group === "prepared" ? 1 : 2,
      gcp_sortorder: 0
    });
    readDv(await Server.Connector.Dataverse.CreateRecord(ENTITY_SET, payload));
    return respondOk(await listMembers());
  } catch (err) {
    Server.Logger.Error("signatorymembers POST failed: " + err.message);
    return respondError(err.message);
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
    Server.Logger.Error("signatorymembers DEL failed: " + err.message);
    return respondError(err.message);
  }
}

async function put() {
  return respondError("Method not supported");
}

async function patch() {
  return respondError("Method not supported");
}
