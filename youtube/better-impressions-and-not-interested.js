// ==UserScript==
// @name        Better Impressions & Not Interested - YouTube
// @namespace   Violentmonkey Scripts
// @match       https://www.youtube.com/
// @grant       GM_getValue
// @grant       GM_setValue
// @version     1.0
// @author      cecilia-sanare
// @description Removes videos that surpass a impression threshold or if the user specifies they aren't interested
// @downloadURL https://raw.githubusercontent.com/cecilia-sanare/violentmonkey-scripts/refs/heads/main/youtube/better-impressions-and-not-interested.js
// @homepageURL https://github.com/cecilia-sanare/violentmonkey-scripts
// ==/UserScript==

if (!GM_getValue('IMPRESSION_THRESHOLD')) {
  GM_setValue('IMPRESSION_THRESHOLD', 3);
}

// Set this to 0 to disable
const IMPRESSION_THRESHOLD = GM_getValue('IMPRESSION_THRESHOLD');

const customStyles = document.createElement('style');

// Corrects margins on videos / video results and adds a class for displaying the impression count.
customStyles.innerHTML = `
  #contents.ytd-rich-grid-renderer {
    margin-left: var(--ytd-rich-grid-gutter-margin);
  }

  ytd-rich-item-renderer[rendered-from-rich-grid][is-in-first-column] {
    margin-left: calc(var(--ytd-rich-grid-item-margin)/2) !important;
  }

  .impression-count {
    position: absolute;
    bottom: 0;
    left: 0;
    font-size: 14px;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    margin: 7px;
    padding: 1px 4px;
    border-radius: 3px;
  }
`;

document.head.appendChild(customStyles);

class DSY {
  static _info = null;

  static get info() {
    if (!DSY._info) {
      const date = new Date().toDateString();
      const raw_info = localStorage.getItem('dsy_info');

      if (raw_info) {
        DSY._info = JSON.parse(raw_info);
      }

      if (!DSY._info || DSY._info.date !== date) {
        DSY.reset();
        DSY.commit();
      }
    }

    return DSY._info;
  }

  static commit() {
    localStorage.setItem('dsy_info', JSON.stringify(DSY._info));
  }

  static reset() {
    const date = new Date().toDateString();

    DSY._info = {
      not_interested: [],
      ...DSY._info,
      impressions: {},
      date,
    };
  }

  static videos = {
    is_hidden(id) {
      return DSY.not_interested.includes(id) || (IMPRESSION_THRESHOLD > 0 && DSY.impressions.get(id) >= IMPRESSION_THRESHOLD - 1);
    },

    hide(element, doNotRemove) {
      DSY.videos.hidden_count++;
      // This is used purely for the top row since YouTube seems to forcibly readd them otherwise
      if (doNotRemove) {
        element.style.display = 'none';
      } else {
        element.parentElement.removeChild(element);
      }
    },

    hidden_count: 0,
  };

  static impressions = {
    get(id) {
      return DSY.info.impressions[id] ?? 0;
    },

    increment(id) {
      DSY.info.impressions[id] = DSY.impressions.get(id) + 1;
    },

    reset(id) {
      delete DSY.info.impressions[id];
    }
  };

  static not_interested = {
    includes(id) {
      return DSY.info.not_interested.includes(id);
    },

    add(id) {
      if (DSY.not_interested.includes(id)) return;

      DSY.info.not_interested.push(id);
    },

    remove(id) {
      const index = DSY.info.not_interested.indexOf(id);

      if (index === -1) return;

      DSY.info.not_interested.splice(index, 1);
    }
  };

  static log(message) {
    console.log(`[DSY]: ${message}`);
  }

  static error(message) {
    console.error(`[DSY]: ${message}`);
  }
}

function flatten(arrays) {
  return arrays.reduce((output, array) => output.concat(array), []);
}

function isTagName(tagName) {
  return (element) => element.tagName?.toLowerCase() === tagName;
}

function isAttribute(name, value) {
  return (element) => element.getAttribute(name) === value;
}

function getVideoId(video) {
  if (!video) return null;

  const link = video.querySelector('a');

  // Skip if no links exist
  if (!link) return null;

  const url = new URL(link.href);
  return url.searchParams.get('v') ?? null;
}

/**
 * Wait for a child element to exist
 */
async function waitFor(tagName, root = document.body) {
  return new Promise((resolve) => {
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        const element = Array.from(record.addedNodes).find((node) => node.tagName.toLowerCase() === tagName.toLowerCase());

        if (element) {
          observer.disconnect();
          return resolve(element);
        }
      }
    });

    observer.observe(root, {
      childList: true
    });
  });
}

function handleImpressions(videos, doNotRemove) {
  let has_changed = false;

  for (const video of videos) {
    // Remove the section separators / shorts
    if (video.tagName.toLowerCase() === 'ytd-rich-section-renderer') {
      video.parentElement.removeChild(video);
      continue;
    }

    const id = getVideoId(video);

    // Skip if no id exists
    if (!id) continue;

    const link = video.querySelector('a');

    if (DSY.videos.is_hidden(id)) DSY.videos.hide(video, doNotRemove);
    else if (IMPRESSION_THRESHOLD !== 0) {
      DSY.impressions.increment(id);
      has_changed = true;

      try {
        const impressions_element = document.createElement('div');
        impressions_element.innerText = `${DSY.impressions.get(id)} Impression(s)`;
        impressions_element.classList.add('impression-count');

        link.appendChild(impressions_element);
      } catch {
        DSY.error('Failed to add impression counter');
      }
    }
  }

  if (has_changed) DSY.commit();

  DSY.log(`${DSY.videos.hidden_count} videos ${doNotRemove ? 'hidden' : 'removed'}`);
}

const start = async () => {
  const browse = await waitFor('ytd-browse', document.querySelector('ytd-page-manager'));
  const contents = browse.querySelector('[id="contents"]');

  handleImpressions(Array.from(contents.querySelectorAll('ytd-rich-item-renderer')), true);

  const observer = new MutationObserver((records) => handleImpressions(flatten(records.map((record) => Array.from(record.addedNodes)))));

  observer.observe(contents, {
    childList: true,
  });

  try {
    document.addEventListener('click', (event) => {
      const path = event.composedPath();

      const id = getVideoId(path.find(isTagName('ytd-rich-item-renderer')));

      if (!id) return;

      if (path.some(isTagName('ytd-menu-renderer'))) {
        const popup = document.querySelector('tp-yt-iron-dropdown');
        const notInterestedDropdown = document.querySelector('tp-yt-iron-dropdown ytd-menu-service-item-renderer:nth-child(6)');
        const popupObserver = new MutationObserver(() => {
          if (popup.style.display !== 'none') return;

          popupObserver.disconnect();
          notInterestedDropdown.removeEventListener('click', onNotInterested);
        });

        const onNotInterested = () => {
          DSY.not_interested.add(id);
          DSY.commit();
          popupObserver.disconnect();
          notInterestedDropdown.removeEventListener('click', onNotInterested);
        };

        popupObserver.observe(popup, {
          attributes: true
        });
        notInterestedDropdown.addEventListener('click', onNotInterested);
      } else if (path.some(isAttribute('aria-label', 'Undo'))) {
        DSY.not_interested.remove(id);
        DSY.commit();
      }
    });
  } catch {
    DSY.error('Failed to hook not interested option.');
  }
};

start();
