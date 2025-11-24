/* -------------------------------------------------------
   Solivre MVP — VERIFIER JS
-------------------------------------------------------- */

const API = "http://localhost:4000/proof/verify";

const identityInput = document.getElementById("identity-input");
const proofInput = document.getElementById("proof-input");

const btnVerify = document.getElementById("btn-verify");
const btnClear = document.getElementById("btn-clear");

const verifyStatus = document.getElementById("verify-status");
const verifyOutput = document.getElementById("verify-output");

/* ------------------ HELPERS ------------------ */

function safeParse(jsonText) {
  try {
    return { ok: true, data: JSON.parse(jsonText) };
  } catch (err) {
    return { ok: false, error: "Invalid JSON format" };
  }
}

/* ------------------ VERIFY ------------------ */

async function verifyProof() {
  verifyStatus.textContent = "Verifying...";
  verifyOutput.textContent = "";

  const parsedIdentity = safeParse(identityInput.value);
  const parsedProof = safeParse(proofInput.value);

  if (!parsedIdentity.ok) {
    verifyStatus.textContent = "❌ Identity JSON invalid";
    return;
  }
  if (!parsedProof.ok) {
    verifyStatus.textContent = "❌ Proof JSON invalid";
    return;
  }

  const identity = parsedIdentity.data;
  const proofBundle = parsedProof.data;

  // Check identityId matches
  if (identity.identityId !== proofBundle.identityId) {
    verifyStatus.textContent = "❌ identityId mismatch";
    return;
  }

  // Send to backend
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(proofBundle)
    });

    const data = await res.json();

    if (data.valid) {
      verifyStatus.innerHTML = `<span class="valid-text">✔ VALID PROOF</span>`;
    } else {
      verifyStatus.textContent = "❌ Invalid proof";
    }

    verifyOutput.textContent = JSON.stringify(data, null, 2);

  } catch (err) {
    verifyStatus.textContent = "❌ Network or backend error";
  }
}

/* ------------------ HANDLERS ------------------ */

btnVerify.addEventListener("click", verifyProof);

btnClear.addEventListener("click", () => {
  identityInput.value = "";
  proofInput.value = "";
  verifyStatus.textContent = "";
  verifyOutput.textContent = "";
});
