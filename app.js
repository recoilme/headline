const DEFAULT_CORS_PROXY = url => `https://cors.zserge.com/?u=${encodeURIComponent(url)}`;
//https://cors.zserge.com/?u=recostream.go.mail.ru/?n=12&stream_id=huawei_test&query_type=recommends 
const DEFAULT_FEEDS = [
  'https://recostream.go.mail.ru/?n=12&stream_id=huawei_test&query_type=recommends',
  'https://recostream.go.mail.ru/?source_filter_id=8283545368347858465&use_orig_imgs=1&title_length=150&ver=1.103.0&n=12&stream_id=source_only&query_type=recommends',
];

const MAX_NEWS_PER_FEED = 500;
const MAX_NEWS_ON_PAGE = 1000;

const loading = document.querySelector('#loading');
const menu = document.querySelector('#menu');
const title = document.querySelector('#title');
const settings = document.querySelector('#settings');
const keywords = document.querySelector('#settings textarea');
const newsFeeds = document.querySelector('#feeds');
const cards = document.querySelector('#cards');

const feedItem = document.querySelector('#settings-feed-item');
const cardsItem = document.querySelector('#card-item');

// State = {lastSeen: Date, feeds: Array<Feed>}
// Feed = {url: String, Entries: Array<Entry>}
// Entry = {title: String, link: String, timestamp: Date}
const state = (() => {
  try {
    // Restore from local storage
    let state = JSON.parse(localStorage.getItem('state-v1'));
    // Parse timestamps from JSON
    state.feeds.forEach(feed => {
      feed.entries.forEach(e => {
        e.timestamp = new Date(e.timestamp);
      });
    });
    return state;
  } catch (e) {
    // Try importing settings from the URL
    try {
      const settings = JSON.parse(atob(window.location.hash.substring(1)));
      return {
        feeds: settings.feeds.map(url => ({url, entries: []})),
        keywords: settings.keywords,
      };
    } catch (e) {
      // If anything goes wrong - use default values
      return {
        feeds: DEFAULT_FEEDS.map(url => ({url, entries: []})),
        keywords: '',
      };
    }
  }
})();

function save() {
  localStorage.setItem('state-v1', JSON.stringify(state));
  const settings = {
    feeds: state.feeds.map(f => f.url),
    keywords: state.keywords,
  };
  window.location.hash = btoa(JSON.stringify(settings));
}

let urlFilter = '';

// parseFeed converts RSS or Atom text into a list of feed entries
function parseFeed(text) {
  const xml = new DOMParser().parseFromString(text, 'text/xml');
  const map = (c, f) => Array.prototype.slice.call(c, 0).map(f);
  const tag = (item, name) =>
    (item.getElementsByTagName(name)[0] || {}).textContent;
  //console.log('1',xml.documentElement.nodeName);
  switch (xml.documentElement.nodeName) {
    case 'rss':
      return map(xml.documentElement.getElementsByTagName('item'), item => ({
        link: tag(item, 'link'),
        img: tag(item, 'link'),
        title: tag(item, 'title'),
        timestamp: new Date(tag(item, 'pubDate')),
      }));
    case 'feed':
      return map(xml.documentElement.getElementsByTagName('entry'), item => ({
        linkUrl =  map(item.getElementsByTagName('link'), link => {
          const rel = link.getAttribute('rel');
          if (!rel || rel === 'alternate') {
            return link.getAttribute('href');
          }
        })[0],
        link: tag(linkUrl),
        img: tag(item, 'link'),
        title: tag(item, 'title'),
        timestamp: new Date(tag(item, 'updated')),
      }));
    case 'html':
      const jsonData = JSON.parse(text);
      return map(jsonData.items, item => ({
        link: item.data.url,
        title: item.data.title,
        timestamp: new Date(item.data.pubdate*1000),
        img: item.data.pictures[0].url,
      }));
      return [];
  }
  return [];
}

const simplifyLink = link => link.replace(/^.*:\/\/(www\.)?/, '');

function renderSettings() {
  keywords.value = state.keywords;
  newsFeeds.innerHTML = '';
  state.feeds.forEach(f => {
    const el = document.importNode(feedItem.content, true).querySelector('li');
    el.querySelector('span').innerText = simplifyLink(f.url);
    el.querySelector('a').onclick = () => {
      urlFilter = f.url;
      menu.classList.remove('close');
      menu.classList.add('back');
      settings.classList.remove('shown');
      title.innerText = simplifyLink(f.url);
      render(urlFilter);
    };
    el.querySelectorAll('a')[1].onclick = () => {
      if (confirm(`Remove ${f.url}?`)) {
        state.feeds = state.feeds.filter(x => x.url !== f.url);
        save();
        window.location.reload();
      }
    };
    newsFeeds.appendChild(el);
  });
}

function render(urlFilter = '') {
  const marks = state.keywords.split(',').map(k => k.trim()).filter(k => k.length).map(k => {
    let mode = '';
    if (k[0] == "/" && k[k.length - 1] == '/') {
      k = k.substring(1, k.length - 1);
    } else {
      k = '\\b' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b';
      mode = (k.toLowerCase() == k ? 'i' : '');
    }
    return new RegExp(k, mode);
  });
  const highlight = s => marks.some(m => m.exec(s));
  const newsList = [].concat(...state.feeds.filter(f => !urlFilter || f.url == urlFilter).map(f => f.entries))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_NEWS_ON_PAGE);

  cards.innerHTML = '';
  newsList.forEach((n, i) => {
    // Get or create a new item
    let el = cards.childNodes[i];
    if (!el) {
      el = document.importNode(cardsItem.content, true).querySelector('article');
      cards.appendChild(el);
    }
    el.querySelector('.card__title').innerText = n.title;
    el.querySelector('.card__img').style.backgroundImage = "url('"+n.img+"')";
    el.querySelector('.card__img--hover').style.backgroundImage = "url('"+n.img+"')";
    el.querySelector('a').href = n.link;
    el.querySelector('.card__author').href = n.link;
    el.querySelector('.card__author').innerText = `${simplifyLink(n.link).split('/')[0]}`;
    el.querySelector('.card__time').innerText = n.timestamp.toLocaleDateString(undefined, { month: 'long', day: '2-digit' });
  });
}

function onMenuClicked() {
  if (menu.classList.contains('close')) {
    title.innerText = '';
    menu.classList.remove('close');
    settings.classList.remove('shown');
  } else if (menu.classList.contains('back')) {
    title.innerText = '';
    urlFilter = '';
    menu.classList.remove('back');
    render(urlFilter);
  } else {
    title.innerText = 'Settings';
    menu.classList.add('close');
    settings.classList.add('shown');
  }
}

function onDoneClicked() {
  onMenuClicked();
  render(urlFilter);
}

function onAddFeedClicked() {
  const url = prompt(`Enter feed URL:`);
  if (url) {
    if (!state.feeds.some(f => f.url === url)) {
      state.feeds.push({url, entries: []});
      save();
      window.location.reload();
    }
  }
}

function onKeywordsChanged(keywords) {
  state.keywords = keywords;
  save();
}

(async () => {
  // Register service worker for PWA
  navigator.serviceWorker.register('sw.js');
  // Render cached news
  save();
  renderSettings();
  render(urlFilter);
  // Fetch each feed and render the settings screen
  for (const feed of state.feeds) {
    const f = parseFeed(await fetch(DEFAULT_CORS_PROXY(feed.url)).then(res => res.text()));
    feed.entries = feed.entries
      .concat(
        f.filter(e => feed.entries.findIndex(x => (x.link === e.link || x.title === e.title)) < 0),
      )
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_NEWS_PER_FEED);
    localStorage.setItem('state-v1', JSON.stringify(state));
  }
  
  // Hide loading indicator
  loading.classList.add('hidden');
  render(urlFilter);
})();
