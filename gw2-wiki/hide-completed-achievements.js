// ==UserScript==
// @name        wiki.guildwars2.com - Hide Completed Achievements
// @namespace   Violentmonkey Scripts
// @match       https://wiki.guildwars2.com/*
// @grant       none
// @version     1.0
// @author      cecilia-sanare
// @description Automatically hide completed achievements
// @downloadURL https://raw.githubusercontent.com/cecilia-sanare/violentmonkey-scripts/refs/heads/main/gw2-wiki/hide-completed-achievements.js
// @homepageURL https://github.com/cecilia-sanare/violentmonkey-scripts
// @require https://cdn.jsdelivr.net/npm/@violentmonkey/dom@2
// @top-level-await
// ==/UserScript==

const observer = new MutationObserver((records) => {
  const achievements_nodes = records.map((record) => {
    return Array.from(record.addedNodes).find((node) => {
      return node.tagName === 'STYLE' && node.id === 'hideachievements';
    });
  }).filter(Boolean);

  for (const node of achievements_nodes) {
    node.innerHTML = node.innerHTML.replace('opacity: 0.2;', 'display: none;');
  }
});

observer.observe(document.head, {
  childList: true,
});

function waitForElement(selector) {
  return new Promise((resolve) => {
    VM.observe(document.body, () => {
      const node = document.querySelector(selector);

      if (node) {
        resolve(node);
        return true;
      }
    });
  });
}


const apply = await waitForElement('#WidgetAccountAchievements-controls > input[value="Apply"]');

if (apply) {
  apply.click();

  // Check for new achievements every 10 seconds.
  setInterval(() => apply.click(), 1000 * 10);
} else {
  console.warn('[CS]: Failed to find the "Apply" button...');
}
