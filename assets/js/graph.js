document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_IDENTITIES_KEY = "solivreIdentities";
  const STORAGE_ATTRS_KEY      = "solivreAttributes";
  const STORAGE_PROOFS_KEY     = "solivreProofs";

  const identityList  = document.getElementById("identity-list");
  const chainView     = document.getElementById("chain-view");
  const detailsBox    = document.getElementById("details-box");
  const reloadBtn     = document.getElementById("btn-reload-graph");
  const statusEl      = document.getElementById("graph-status");

  let identities = {};
  let attrsMap   = {};
  let proofsMap  = {};
  let activeId   = null;

  function setText(el, msg, color) {
    if (!el) return;
    el.textContent = msg || "";
    if (color) el.style.color = color;
  }

  function loadFromStorage() {
    identities = {};
    attrsMap   = {};
    proofsMap  = {};

    try {
      const rawIds = localStorage.getItem(STORAGE_IDENTITIES_KEY);
      if (rawIds) identities = JSON.parse(rawIds) || {};
    } catch {
      identities = {};
    }

    try {
      const rawAttrs = localStorage.getItem(STORAGE_ATTRS_KEY);
      if (rawAttrs) attrsMap = JSON.parse(rawAttrs) || {};
    } catch {
      attrsMap = {};
    }

    try {
      const rawProofs = localStorage.getItem(STORAGE_PROOFS_KEY);
      if (rawProofs) proofsMap = JSON.parse(rawProofs) || {};
    } catch {
      proofsMap = {};
    }
  }

  function shortHash(str) {
    if (!str || typeof str !== "string") return "";
    if (str.length <= 12) return str;
    return str.slice(0, 6) + "…" + str.slice(-4);
  }

  function renderIdentityList() {
    if (!identityList) return;
    identityList.innerHTML = "";

    const ids = Object.keys(identities);
    if (!ids.length) {
      const li = document.createElement("li");
      li.className = "hint";
      li.textContent = "No identities found. Create one in the Agent.";
      identityList.appendChild(li);
      return;
    }

    ids.forEach((id) => {
      const snap = identities[id] || {};
      const li = document.createElement("li");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "identity-item";
      if (id === activeId) {
        btn.classList.add("active");
      }

      const title = document.createElement("div");
      title.textContent = "Identity";
      const idSpan = document.createElement("span");
      idSpan.className = "identity-id";
      idSpan.textContent = shortHash(id);

      const meta = document.createElement("div");
      meta.className = "identity-meta";
      const commitment = snap.commitment ? shortHash(snap.commitment) : "—";
      const proofsCount = (proofsMap[id] && proofsMap[id].length) || 0;
      meta.textContent = `Commitment: ${commitment} • Proofs: ${proofsCount}`;

      btn.appendChild(title);
      btn.appendChild(idSpan);
      btn.appendChild(meta);

      btn.addEventListener("click", () => {
        activeId = id;
        renderIdentityList(); // refresh active style
        renderChainForIdentity(id);
      });

      li.appendChild(btn);
      identityList.appendChild(li);
    });
  }

  function createChainNode(label, metaLines, obj) {
    const node = document.createElement("div");
    node.className = "chain-node";

    const title = document.createElement("div");
    title.className = "chain-node-title";
    title.textContent = label;

    const meta = document.createElement("div");
    meta.className = "chain-node-meta";
    meta.textContent = metaLines.join(" • ");

    node.appendChild(title);
    node.appendChild(meta);

    node.addEventListener("click", () => {
      if (!detailsBox) return;
      detailsBox.textContent = JSON.stringify(obj, null, 2);
    });

    return node;
  }

  function addArrow(container) {
    const arrow = document.createElement("div");
    arrow.className = "chain-arrow";
    arrow.textContent = "↓";
    container.appendChild(arrow);
  }

  function renderChainForIdentity(identityId) {
    if (!chainView) return;
    chainView.innerHTML = "";

    const snap = identities[identityId];
    if (!snap) {
      const p = document.createElement("p");
      p.className = "hint";
      p.textContent = "No snapshot found for this identity.";
      chainView.appendChild(p);
      setText(statusEl, "No snapshot for selected identity.", "#ff7b8a");
      return;
    }

    const attrs = attrsMap[identityId] || null;
    const proofs = proofsMap[identityId] || [];

    // Identity node
    const idMeta = [];
    if (snap.identityId) {
      idMeta.push(shortHash(snap.identityId));
    }
    if (snap.commitment) {
      idMeta.push("commitment " + shortHash(snap.commitment));
    }
    if (snap.attributesRoot) {
      idMeta.push("root " + shortHash(snap.attributesRoot));
    }

    const idNode = createChainNode("Identity", idMeta, snap);
    chainView.appendChild(idNode);

    // Attributes node (if we have them)
    if (attrs) {
      addArrow(chainView);
      const attrsMeta = [];
      if (attrs.birthdate) attrsMeta.push("birthdate " + attrs.birthdate);
      if (attrs.country) attrsMeta.push("country " + attrs.country);
      if (!attrsMeta.length) attrsMeta.push("attributes stored");

      const attrsNode = createChainNode("Attributes", attrsMeta, attrs);
      chainView.appendChild(attrsNode);
    }

    // Proofs nodes
    if (proofs && proofs.length) {
      proofs.forEach((proof, index) => {
        addArrow(chainView);
        const proofMeta = [];
        if (proof.templateId) proofMeta.push(proof.templateId);
        if (proof.proofHash) proofMeta.push(shortHash(proof.proofHash));
        if (proof.issuedAt) proofMeta.push(proof.issuedAt);
        const proofNode = createChainNode(`Proof #${index + 1}`, proofMeta, proof);
        chainView.appendChild(proofNode);
      });
    }

    if (!attrs && (!proofs || !proofs.length)) {
      const p = document.createElement("p");
      p.className = "hint";
      p.textContent = "No attributes or proofs stored yet for this identity.";
      chainView.appendChild(p);
    }

    setText(statusEl, "Chain rendered for identity " + shortHash(identityId), "#a3b0ff");
    if (detailsBox) {
      detailsBox.textContent = JSON.stringify(snap, null, 2);
    }
  }

  function initialRender() {
    loadFromStorage();
    renderIdentityList();

    const ids = Object.keys(identities);
    if (ids.length) {
      activeId = ids[0];
      renderChainForIdentity(activeId);
      setText(
        statusEl,
        "Loaded " + ids.length + " identities from local storage.",
        "#7ae39c"
      );
    } else {
      if (chainView) {
        chainView.innerHTML = "";
        const p = document.createElement("p");
        p.className = "hint";
        p.textContent = "No identities found. Use the Agent to create one.";
        chainView.appendChild(p);
      }
      setText(statusEl, "No identities in local storage yet.", "#ffcc66");
    }
  }

  if (reloadBtn) {
    reloadBtn.addEventListener("click", () => {
      initialRender();
    });
  }

  // Kick off
  initialRender();
});
