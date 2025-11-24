// assets/js/agent.js

document.addEventListener("DOMContentLoaded", () => {
  const API = "http://localhost:4000";

  // ---- DOM REFERENCES --------------------------------------------------
  const btnCreateIdentity = document.getElementById("btn-create-identity");
  const identitySelect    = document.getElementById("identity-select");
  const identityStatus    = document.getElementById("identity-status");
  const identityOutput    = document.getElementById("identity-output");

  const birthdateInput    = document.getElementById("birthdate");
  const countryInput      = document.getElementById("country");
  const btnSaveAttrs      = document.getElementById("btn-save-attrs");
  const attrsStatus       = document.getElementById("attrs-status");
  const attrsOutput       = document.getElementById("attrs-output");

  const btnGenerateProof  = document.getElementById("btn-generate-proof");
  const proofStatus       = document.getElementById("proof-status");
  const proofOutput       = document.getElementById("proof-output");

  const identityExport    = document.getElementById("identity-export");
  const proofExport       = document.getElementById("proof-export");
  const btnCopyIdentity   = document.getElementById("btn-copy-identity");
  const btnCopyProof      = document.getElementById("btn-copy-proof");
  const btnOpenVerifier   = document.getElementById("btn-open-verifier");

  // ---- IN-MEMORY SNAPSHOTS ---------------------------------------------
  // Map: identityId -> last known snapshot { identityId, commitment, attributesRoot? }
  const identities = {};

  function setText(el, msg, color) {
    if (!el) return;
    el.textContent = msg || "";
    if (color) el.style.color = color;
  }

  function ensureIdentityOption(identityId) {
    if (!identitySelect || !identityId) return;

    let existing = identitySelect.querySelector(`option[value="${identityId}"]`);
    if (!existing) {
      const opt = document.createElement("option");
      opt.value = identityId;
      opt.textContent = identityId;
      identitySelect.appendChild(opt);
    }
    identitySelect.value = identityId;
  }

  function renderIdentity(data) {
    if (!data || !data.identityId) return;

    const identityId = data.identityId;
    identities[identityId] = data; // cache snapshot

    // Keep dropdown in sync
    ensureIdentityOption(identityId);

    // Show JSON snapshot
    if (identityOutput) {
      identityOutput.textContent = JSON.stringify(data, null, 2);
    }
    if (identityExport) {
      identityExport.value = JSON.stringify(data, null, 2);
    }

    // Enable UI actions once we have at least one identity
    if (btnSaveAttrs)     btnSaveAttrs.disabled     = false;
    if (btnGenerateProof) btnGenerateProof.disabled = false;
    if (btnCopyIdentity)  btnCopyIdentity.disabled  = false;

    setText(identityStatus, "Identity ready.", "#7ae39c");
  }

  function renderProof(proof) {
    if (!proof) return;
    if (proofOutput) {
      proofOutput.textContent = JSON.stringify(proof, null, 2);
    }
    if (proofExport) {
      proofExport.value = JSON.stringify(proof, null, 2);
    }
    if (btnCopyProof) btnCopyProof.disabled = false;
  }

  // -----------------------------------------------------------------------
  // 1. CREATE IDENTITY  (NO HIDDEN EXTRA CALLS)
  // -----------------------------------------------------------------------
  if (btnCreateIdentity) {
    btnCreateIdentity.addEventListener("click", async () => {
      setText(identityStatus, "Creating identity…", "#a3b0ff");

      try {
        const resp = await fetch(`${API}/identity`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}) // create fresh identity only once
        });

        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(text || "Backend error (/identity)");
        }

        const data = await resp.json();
        if (!data.identityId) {
          throw new Error("No identityId in /identity response");
        }

        renderIdentity(data);
        setText(identityStatus, "Identity created.", "#7ae39c");
      } catch (err) {
        console.error(err);
        setText(identityStatus, "Failed: " + err.message, "#ff7b8a");
      }
    });
  }

  // When you switch identity from dropdown, show cached snapshot.
  if (identitySelect) {
    identitySelect.addEventListener("change", () => {
      const id = identitySelect.value;
      if (!id) return;

      const snap = identities[id];
      if (!snap) {
        // This can happen if page was reloaded (in-memory only).
        console.warn("No cached snapshot for identity:", id, identities);
        setText(
          identityStatus,
          "No cached snapshot for this identity in this session.",
          "#ffcc66"
        );
        return;
      }

      renderIdentity(snap);
    });
  }

  // -----------------------------------------------------------------------
  // 2. SAVE ATTRIBUTES  (NO NEW /identity CALLS)
  // -----------------------------------------------------------------------
  if (btnSaveAttrs) {
    btnSaveAttrs.addEventListener("click", async (e) => {
      e.preventDefault();

      const identityId = identitySelect?.value;
      const birthdate  = (birthdateInput?.value || "").trim();
      const country    = (countryInput?.value || "").trim().toUpperCase();

      if (!identityId) {
        setText(attrsStatus, "No active identity selected.", "#ff7b8a");
        return;
      }
      if (!birthdate || !country) {
        setText(attrsStatus, "Birthdate & country required.", "#ff7b8a");
        return;
      }

      setText(attrsStatus, "Saving attributes…", "#a3b0ff");

      try {
        const attrResp = await fetch(`${API}/attributes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identityId,
            attributes: { birthdate, country }
          })
        });

        if (!attrResp.ok) {
          const text = await attrResp.text();
          throw new Error(text || "Backend error (/attributes)");
        }

        const attrData = await attrResp.json();

        // Show raw attributes response
        if (attrsOutput) {
          attrsOutput.textContent = JSON.stringify(attrData, null, 2);
        }

        // Treat attrData as updated identity snapshot (commitment + root)
        renderIdentity(attrData);
        setText(attrsStatus, "Attributes saved.", "#7ae39c");
      } catch (err) {
        console.error(err);
        setText(attrsStatus, "Failed: " + err.message, "#ff7b8a");
      }
    });
  }

  // -----------------------------------------------------------------------
  // 3. GENERATE PROOF  (USING CORRECT IDENTITY + COMMITMENT)
  // -----------------------------------------------------------------------
  if (btnGenerateProof) {
    btnGenerateProof.addEventListener("click", async () => {
      const identityId = identitySelect?.value;
      if (!identityId) {
        setText(proofStatus, "Select an identity first.", "#ff7b8a");
        return;
      }

      const identity = identities[identityId];
      if (!identity) {
        setText(
          proofStatus,
          "No cached identity snapshot. Create or update attributes first.",
          "#ff7b8a"
        );
        console.warn("No cached identity for proof:", identityId, identities);
        return;
      }

      const commitment = identity.commitment;
      if (!commitment) {
        setText(
          proofStatus,
          "Identity has no commitment (check /identity or /attributes responses).",
          "#ff7b8a"
        );
        console.warn("Identity without commitment:", identity);
        return;
      }

      setText(proofStatus, "Generating proof…", "#a3b0ff");

      try {
        const resp = await fetch(`${API}/proof`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identityId,
            commitment,
            templateId: "age_over_18_and_resident_pt"
          })
        });

        const text = await resp.text();
        let proof;
        try {
          proof = JSON.parse(text);
        } catch {
          proof = text;
        }

        if (!resp.ok) {
          setText(
            proofStatus,
            "Failed: " + (proof && proof.error ? proof.error : resp.status),
            "#ff7b8a"
          );
          if (proofOutput) {
            proofOutput.textContent =
              typeof proof === "string" ? proof : JSON.stringify(proof, null, 2);
          }
          return;
        }

        renderProof(proof);
        setText(proofStatus, "Proof generated.", "#7ae39c");
      } catch (err) {
        console.error(err);
        setText(proofStatus, "Failed: " + err.message, "#ff7b8a");
      }
    });
  }

  // -----------------------------------------------------------------------
  // 4. COPY BUTTONS
  // -----------------------------------------------------------------------
  if (btnCopyIdentity) {
    btnCopyIdentity.addEventListener("click", async () => {
      if (!identityExport || !identityExport.value) return;
      await navigator.clipboard.writeText(identityExport.value);
      const old = btnCopyIdentity.textContent;
      btnCopyIdentity.textContent = "Copied!";
      setTimeout(() => (btnCopyIdentity.textContent = old), 900);
    });
  }

  if (btnCopyProof) {
    btnCopyProof.addEventListener("click", async () => {
      if (!proofExport || !proofExport.value) return;
      await navigator.clipboard.writeText(proofExport.value);
      const old = btnCopyProof.textContent;
      btnCopyProof.textContent = "Copied!";
      setTimeout(() => (btnCopyProof.textContent = old), 900);
    });
  }

  // -----------------------------------------------------------------------
  // 5. OPEN VERIFIER (NEW TAB)
  // -----------------------------------------------------------------------
  if (btnOpenVerifier) {
    btnOpenVerifier.addEventListener("click", (e) => {
      e.preventDefault();
      window.open("verifier.html", "_blank"); // new tab
    });
  }
});
