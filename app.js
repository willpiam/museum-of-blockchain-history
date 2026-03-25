const CHAIN_CONFIG = {
    bitcoin: {
        label: "Bitcoin",
        file: "data/bitcoin.json",
    },
    ethereum: {
        label: "Ethereum",
        file: "data/ethereum.json",
    },
    cardano: {
        label: "Cardano",
        file: "data/cardano.json",
    },
};

function getGrid(chainKey) {
    return document.querySelector(`[data-events-for="${chainKey}"]`);
}

function setGridState(chainKey, state, message) {
    const grid = getGrid(chainKey);
    if (!grid) {
        return;
    }

    grid.dataset.loading = state === "loading" ? "true" : "false";
    grid.dataset.empty = state === "empty" || state === "error" ? "true" : "false";
    grid.dataset.message = message || "";
}

function normalizeTxHashes(txHashes) {
    if (!Array.isArray(txHashes)) {
        return [];
    }
    return txHashes
        .map((entry) => {
            if (typeof entry === "string" && entry.trim().length > 0) {
                return { hash: entry.trim(), description: "" };
            }
            if (entry && typeof entry === "object" && typeof entry.hash === "string" && entry.hash.trim().length > 0) {
                return { hash: entry.hash.trim(), description: typeof entry.description === "string" ? entry.description.trim() : "" };
            }
            return null;
        })
        .filter(Boolean);
}

function createExplorerLinks(explorerBase, txHashes) {
    const links = normalizeTxHashes(txHashes);
    if (links.length === 0) {
        return "";
    }

    return links
        .map(({ hash, description }) => {
            const txUrl = `${explorerBase}${hash}`;
            const safeHash = escapeHtml(hash);
            const descMarkup = description ? `<span class="tx-description">${escapeHtml(description)}</span>` : "";
            return `<li><a class="event-link" href="${txUrl}" target="_blank" rel="noopener noreferrer">${safeHash}</a>${descMarkup}</li>`;
        })
        .join("");
}

function escapeHtml(input) {
    return String(input)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function createEventCard(event, explorerBase) {
    const safeEvent = event || {};
    const eventTitle = typeof safeEvent.title === "string" ? safeEvent.title.trim() : "";
    const eventDescription = typeof safeEvent.description === "string" ? safeEvent.description.trim() : "";

    const title = escapeHtml(eventTitle || "Untitled Event");
    const description = escapeHtml(eventDescription || "Description coming soon.");
    const linksMarkup = createExplorerLinks(explorerBase, safeEvent.tx_hashes);

    return `
        <article class="event-card">
            <h3 class="event-title">${title}</h3>
            <p class="event-description">${description}</p>
            ${linksMarkup ? `<ul class="event-links">${linksMarkup}</ul>` : ""}
        </article>
    `;
}

function renderChain(chainKey, chainData) {
    const grid = getGrid(chainKey);
    if (!grid) {
        return;
    }

    const events = chainData && Array.isArray(chainData.events) ? chainData.events : [];
    const explorerBase = chainData && chainData.settings ? chainData.settings.explorer || "" : "";

    if (events.length === 0) {
        grid.innerHTML = "";
        setGridState(chainKey, "empty", "No events are available for this chain yet.");
        return;
    }

    grid.innerHTML = events.map((event) => createEventCard(event, explorerBase)).join("");
    setGridState(chainKey, "ready", "");
}

async function fetchChainData(chainKey, filePath) {
    const response = await fetch(filePath);
    if (!response.ok) {
        throw new Error(`Failed to load ${chainKey}: ${response.status}`);
    }
    return response.json();
}

async function loadAndRenderAllChains() {
    const chainEntries = Object.entries(CHAIN_CONFIG);

    chainEntries.forEach(([chainKey]) => {
        setGridState(chainKey, "loading", "Loading exhibits...");
    });

    await Promise.all(
        chainEntries.map(async ([chainKey, config]) => {
            try {
                const chainData = await fetchChainData(chainKey, config.file);
                renderChain(chainKey, chainData);
            } catch (error) {
                const grid = getGrid(chainKey);
                if (grid) {
                    grid.innerHTML = "";
                }
                setGridState(chainKey, "error", `Unable to load ${config.label} exhibits right now.`);
                console.error(error);
            }
        }),
    );
}

function applyChainFilter(filter) {
    const sections = document.querySelectorAll(".chain-section");
    sections.forEach((section) => {
        const chainName = section.getAttribute("data-chain");
        const shouldShow = filter === "all" || chainName === filter;
        section.hidden = !shouldShow;
    });

    const buttons = document.querySelectorAll(".chain-filter");
    buttons.forEach((button) => {
        const selected = button.dataset.filter === filter;
        button.classList.toggle("is-active", selected);
        button.setAttribute("aria-pressed", selected ? "true" : "false");
    });
}

function updateUrlForFilter(filter) {
    if (filter === "all") {
        window.history.replaceState(null, "", window.location.pathname);
        return;
    }
    window.history.replaceState(null, "", `#${filter}`);
}

function setupNavigation() {
    const buttons = document.querySelectorAll(".chain-filter");
    buttons.forEach((button) => {
        button.addEventListener("click", () => {
            const selectedFilter = button.dataset.filter || "all";
            applyChainFilter(selectedFilter);
            updateUrlForFilter(selectedFilter);

            if (selectedFilter === "all") {
                return;
            }

            const target = document.getElementById(`chain-${selectedFilter}`);
            if (target) {
                target.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        });
    });

    const fromHash = window.location.hash.replace("#", "");
    if (fromHash && CHAIN_CONFIG[fromHash]) {
        applyChainFilter(fromHash);
        const target = document.getElementById(`chain-${fromHash}`);
        if (target) {
            requestAnimationFrame(() => {
                target.scrollIntoView({ behavior: "smooth", block: "start" });
            });
        }
    } else {
        applyChainFilter("all");
    }
}

async function initMuseum() {
    setupNavigation();
    await loadAndRenderAllChains();
}

document.addEventListener("DOMContentLoaded", initMuseum);
