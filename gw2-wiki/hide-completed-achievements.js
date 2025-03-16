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

const style = document.createElement('style');
style.id = 'cecilia-sanare/violentmonkey-scripts';
style.innerText = `
  *[hidden] {
    display: none !important;
  }

  .total-achievements {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .total-achievements-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    background: rgba(255, 255, 255, 0.5);
    border-radius: 100%;
  }

  .total-achievements-icon.done {
    color: #4fa641;
  }

  .total-achievements-icon.not-done {
    color: #942213;
  }
`;
document.head.appendChild(style);

const apply = await waitForElement('#WidgetAccountAchievements-controls > input[value="Apply"]');

if (apply) apply.click();

// Check for new achievements every 10 seconds.
const interval = apply ? setInterval(() => apply.click(), 1000 * 10) : undefined;

const observer = new MutationObserver((records) => {
  const achievements_nodes = records.map((record) => {
    return Array.from(record.addedNodes).find((node) => {
      return node.tagName === 'STYLE' && node.id === 'hideachievements';
    });
  }).filter(Boolean);

  const hidden_ids = achievements_nodes.reduce((output, node) => {
    const id_groups = node.innerText.matchAll(/\[data-id="(achievement\d+)"\]/g);
    const ids = Array.from(id_groups).map(([, id]) => id);

    return [
      ...output,
      ...ids
    ];
  }, []);

  const tables = document.querySelectorAll('table:has(tr[data-id^="achievement"])');

  for (const table of tables) {
    const achievement_rows = table.querySelectorAll('tr[data-id^="achievement"]');
    const total_achievements_th = table.querySelector('tr:not([data-id]):first-child > th:nth-child(2)');
    const total_achievements = Array.from(achievement_rows).reduce((output, node) => node.className.includes('line') ? output + 1 : output, 0);

    let hidden_count = 0;
    for (const row of achievement_rows) {
      const isLine = row.className.includes('line');

      if (hidden_ids.some((id) => id.startsWith(row.dataset.id))) {
        if (isLine) {
          hidden_count++;
        }

        row.setAttribute('hidden', '');
      } else {
        row.removeAttribute('hidden', '');
      }
    }

    if (total_achievements === hidden_count) {
      clearInterval(interval);
      total_achievements_th.innerHTML = `
        <div class="total-achievements">
          Completed!
          <div class="total-achievements-icon done" title="Completed">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-circle-check"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
          </div>
        </div>
      `;
    } else {
      total_achievements_th.innerHTML = `
        <div class="total-achievements">
          Remaining achievements: ${total_achievements - hidden_count} / ${total_achievements}
          <div class="total-achievements-icon not-done" title="Not Completed">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-circle-x"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
          </div>
        </div>
      `;
    }
  }
});

observer.observe(document.head, {
  childList: true,
});

