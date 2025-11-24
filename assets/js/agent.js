/* -------------------------------------------------------
   Solivre MVP UI — AGENT JS
   Works with backend running at localhost:4000
-------------------------------------------------------- */

const API_BASE = "http://localhost:4000";

const identityStatusEl = document.getElementById("identity-status");
const proofStatusEl = document.getElementById("proof-status");

const identitySelect = document.getElementById("identity-select");
const birthdateInput = document.getElementById("birthdate");
const countryInput = document.getElementById("country");

const btnCreate = document.getElementById("btn-create-identity");
const btnSave = document.getElementById("btn-save-attrs");
const btnProof = document.getElementById("btn-generate-proof");

const identityExport = document.getElementById("identity-export");
const proofExport = document.getElementById("proof-export");

let identities = [];
let activeIdentity = null;

/* ------------------ HELPERS ------------------ */

function renderIdentities() {
  identitySelect.innerHTML = "";

  if (identities.length === 0) {
    identitySelect.innerHTML = `<option>No identities yet</option>`;
    return;
  }

  for (const id of identities) {
    const opt = document.createElement("option");
    opt.value = id.identityId;
    opt.textContent = id.identityId.slice(0, 10) + "...";
    if (activeIdentity && activeIdentity.identityId === id.identityId) {
      opt.selected = true;
    }
    identitySelect.appendChild(opt);
  }
}

function setActive(id) {
  activeIdentity = identities.find(x => x.identityId === id) || null;
  updateExports();
}

function updateExports() {
  if (!activeIdentity) {
    identityExport.value = "";
    proofExport.value = "";
    return;
  }

  identityExport.value = JSON.stringify({
    identityId: activeIdentity.identityId,
    commitment: activeIdentity.commitment,
    attributesRoot: activeIdentity.attributesRoot
  }, null, 2);

  if (activeIdentity.proof) {
    proofExport.value = JSON.stringify(activeIdentity.proof, null, 2);
  } else {
    proofExport.value = "";
  }
}

/* ------------------ API CALLS ------------------ */

async function callAPI(url, method = "POST", body = {}) {
  try {
    const res = await fetch(`${API_BASE}${url}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Backend error");
    return data;

  } catch (err) {
    return { error: err.message || "Network error" };
  }
}

/* ------------------ BUTTON HANDLERS ------------------ */

btnCreate.addEventListener("click", async () => {
  identityStatusEl.textContent = "Creating identity...";

  const data = await callAPI("/identity");

  if (data.error) {
    identityStatusEl.textContent = "❌ " + data.error;
    return;
  }

  identities.push({
    ...data,
    attributes: {},
    proof: null
  });

  setActive(data.identityId);
  renderIdentities();

  identityStatusEl.textContent = "Identity created";
});

btnSave.addEventListener("click", async () => {
  if (!activeIdentity) return;

  const birthdate = birthdateInput.value;
  const country = countryInput.value;

  identityStatusEl.textContent = "Saving attributes...";

  const data = await callAPI("/attributes", "POST", {
    identityId: activeIdentity.identityId,
    birthdate,
    country
  });

  if (data.error) {
    identityStatusEl.textContent = "❌ " + data.error;
    return;
  }

  activeIdentity.commitment = data.commitment;
  activeIdentity.attributesRoot = data.attributesRoot;
  activeIdentity.attributes = { birthdate, country };
  activeIdentity.proof = null;

  identityStatusEl.textContent = "Attributes saved";
  updateExports();
});

btnProof.addEventListener("click", async () => {
  if (!activeIdentity) return;

  proofStatusEl.textContent = "Generating proof...";

  const data = await callAPI("/proof", "POST", {
    identityId: activeIdentity.identityId,
    commitment: activeIdentity.commitment,
    templateId: "age_over_18_and_resident_pt"
  });

  if (data.error) {
    proofStatusEl.textContent = "❌ " + data.error;
    return;
  }

  activeIdentity.proof = data;
  proofStatusEl.textContent = "Proof generated";
  updateExports();
});

/* ------------------ UI INIT ------------------ */

identitySelect.addEventListener("change", () => {
  setActive(identitySelect.value);
});
