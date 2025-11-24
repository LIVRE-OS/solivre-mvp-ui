// assets/js/verifier.js
document.addEventListener("DOMContentLoaded", () => {
  const API = "http://localhost:4000";

  const identityInput = document.getElementById("identity-input");
  const proofInput    = document.getElementById("proof-input");
  const btnVerify     = document.getElementById("btn-verify");
  const btnClear      = document.getElementById("btn-clear");
  const verifyStatus  = document.getElementById("verify-status");
  const verifyOutput  = document.getElementById("verify-output");

  function setText(el, msg, color) {
    if (!el) return;
    el.textContent = msg || "";
    if (color) el.style.color = color;
  }

  if (btnClear) {
    btnClear.addEventListener("click", () => {
      if (identityInput) identityInput.value = "";
      if (proofInput) proofInput.value = "";
      if (verifyOutput) verifyOutput.textContent = "";
      setText(verifyStatus, "", "");
    });
  }

  if (!btnVerify) return;

  btnVerify.addEventListener("click", async () => {
    // 1) Parse Identity JSON
    let identityObj;
    try {
      identityObj = JSON.parse(identityInput?.value || "{}");
    } catch (err) {
      setText(verifyStatus, "Identity JSON is not valid JSON.", "#ff7b8a");
      return;
    }

    let identityId =
      identityObj.identityId || identityObj.id || identityObj.identity_id;

    if (!identityId || typeof identityId !== "string") {
      setText(
        verifyStatus,
        "Identity JSON must contain an identityId.",
        "#ff7b8a"
      );
      return;
    }

    // 2) Parse Proof JSON
    let proofObj;
    try {
      proofObj = JSON.parse(proofInput?.value || "{}");
    } catch (err) {
      setText(verifyStatus, "Proof JSON is not valid JSON.", "#ff7b8a");
      return;
    }

    if (!proofObj || typeof proofObj !== "object") {
      setText(verifyStatus, "Proof JSON must be an object.", "#ff7b8a");
      return;
    }

    // Accept both shapes:
    //  A) plain bundle: { identityId, templateId, proofHash, issuedAt }
    //  B) wrapped:      { identityId, proof: { ...bundle... } }
    let bundle = proofObj;

    if (
      bundle.proof &&
      typeof bundle.proof === "object" &&
      bundle.proof.proofHash
    ) {
      // Unwrap the inner proof bundle
      bundle = bundle.proof;
    }

    // Make sure bundle has identityId
    if (!bundle.identityId) {
      bundle.identityId = identityId;
    }

    // Basic sanity checks before sending
    if (
      typeof bundle.identityId !== "string" ||
      typeof bundle.templateId !== "string" ||
      typeof bundle.proofHash !== "string"
    ) {
      setText(
        verifyStatus,
        "Proof JSON is missing required fields (identityId, templateId, proofHash).",
        "#ff7b8a"
      );
      if (verifyOutput) {
        verifyOutput.textContent = JSON.stringify(bundle, null, 2);
      }
      return;
    }

    // If top-level proofObj had identityId and it's different, warn
    if (proofObj.identityId && proofObj.identityId !== identityId) {
      setText(
        verifyStatus,
        "Warning: identityId in proof does not match identity JSON. Backend will enforce.",
        "#ffcc66"
      );
    } else {
      setText(verifyStatus, "Verifying proof…", "#a3b0ff");
    }

    try {
      const resp = await fetch(`${API}/proof/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identityId,
          proof: bundle
        })
      });

      const text = await resp.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      if (verifyOutput) {
        verifyOutput.textContent =
          typeof data === "string" ? data : JSON.stringify(data, null, 2);
      }

      if (!resp.ok) {
        setText(
          verifyStatus,
          "Verification failed: " +
            (data && data.error ? data.error : resp.status),
          "#ff7b8a"
        );
        return;
      }

      if (data && data.valid === true) {
        setText(verifyStatus, "Proof is VALID ✅", "#22c55e");
      } else if (data && data.valid === false) {
        setText(verifyStatus, "Proof is INVALID ❌", "#ef4444");
      } else {
        setText(verifyStatus, "Verification completed.", "#a3b0ff");
      }
    } catch (err) {
      console.error(err);
      setText(
        verifyStatus,
        "Verification error: " + err.message,
        "#ff7b8a"
      );
    }
  });
});
