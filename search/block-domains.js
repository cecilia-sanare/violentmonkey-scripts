// ==UserScript==
// @name        Block Unwanted Domains
// @namespace   Violentmonkey Scripts
// @match       https://duckduckgo.com/*
// @match       https://www.google.com/*
// @grant       GM_getValue
// @grant       GM_setValue
// @version     1.0
// @author      cecilia-sanare
// @description Automatically block unwanted domains on google or duckduckgo
// @downloadURL https://raw.githubusercontent.com/cecilia-sanare/violentmonkey-scripts/refs/heads/main/youtube/block-domains.js
// @homepageURL https://github.com/cecilia-sanare/violentmonkey-scripts
// ==/UserScript==

if (!GM_getValue('UNDESIRABLES')) {
  GM_setValue('UNDESIRABLES', [
    "minecraft.fandom.com",
    "https://minecraft-archive.fandom.com",
  ]);
}

// Set this to 0 to disable
const UNDESIRABLES = GM_getValue('UNDESIRABLES');

const QUERY_BY_HOST = {
  "www.google.com": {
    search: '[id="search"]',
    results: "[data-async-context] > *",
  },
  "duckduckgo.com": {
    search: '[id="react-layout"]',
    results: '[data-nrn="result"]',
  },
};

const queries = QUERY_BY_HOST[location.host];

const layout = document.querySelector(queries.search);

if (!layout) return;

const observer = new MutationObserver(() => {
  const results = layout.querySelectorAll(queries.results);

  for (const result of results) {
    const link = result.querySelector("a");

    if (UNDESIRABLES.some((undesirable) => link.href.includes(undesirable))) {
      result.style.display = "none";
    }
  }
});

observer.observe(layout, {
  subtree: true,
  childList: true,
});
