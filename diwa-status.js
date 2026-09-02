(function () {
  if (window.__diwaStatusLoaded) return;
  window.__diwaStatusLoaded = true;

  var OWNER = "diwa-ai";
  var REPO = "upptime";
  var SUMMARY_URL =
    "https://raw.githubusercontent.com/" +
    OWNER +
    "/" +
    REPO +
    "/master/history/summary.json";
  var ISSUES_API =
    "https://api.github.com/repos/" + OWNER + "/" + REPO + "/issues";
  var HISTORY_BASE =
    "https://raw.githubusercontent.com/" +
    OWNER +
    "/" +
    REPO +
    "/master/history/";

  function isHome() {
    var path = window.location.pathname || "/";
    path = path.replace(/\/+$/, "") || "/";
    return (
      path === "/" ||
      path === "/upptime" ||
      path === "/index.html" ||
      path === "/upptime/index.html"
    );
  }

  if (!isHome()) return;

  var observer = null;
  var retryTimer = null;
  var observeRoot = null;
  var busy = false;
  var done = false;

  var summaryPromise = fetch(SUMMARY_URL)
    .then(function (res) {
      return res.ok ? res.json() : [];
    })
    .catch(function () {
      return [];
    });

  function dayKey(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, "0");
    var d = String(date.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  function parsePercent(value) {
    var n = parseFloat(String(value || "").replace("%", ""));
    return isNaN(n) ? 100 : n;
  }

  function hostnameFromUrl(url) {
    try {
      var parsed = new URL(url);
      var host = parsed.hostname.replace(/^www\./, "");
      var path = parsed.pathname.replace(/\/$/, "");
      if (path && path !== "/") return host + path;
      return host;
    } catch (err) {
      return url || "";
    }
  }

  function overallUptime(sites) {
    if (!sites.length) return "100.00%";
    var total = 0;
    sites.forEach(function (site) {
      total += parsePercent(site.uptimeMonth || site.uptime);
    });
    return (total / sites.length).toFixed(2) + "%";
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function simpleMarkdown(text) {
    return escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\n/g, "<br>");
  }

  function formatWhen(iso) {
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      });
    } catch (err) {
      return iso;
    }
  }

  function tickClass(minutes) {
    if (minutes <= 0) return "up";
    if (minutes >= 720) return "down";
    return "degraded";
  }

  function startOfDay(value) {
    var date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function parseStartTime(yml) {
    var match = String(yml || "").match(/^startTime:\s*(.+)$/m);
    if (!match) return null;
    var date = new Date(match[1].trim());
    return isNaN(date.getTime()) ? null : date;
  }

  function loadStartTimes(sites) {
    return Promise.all(
      sites.map(function (site) {
        if (site.startTime || !site.slug) return Promise.resolve(site);
        return fetch(HISTORY_BASE + encodeURIComponent(site.slug) + ".yml")
          .then(function (res) {
            return res.ok ? res.text() : "";
          })
          .then(function (yml) {
            site.startTime = parseStartTime(yml);
            return site;
          })
          .catch(function () {
            return site;
          });
      })
    );
  }

  function buildBar(dailyMinutesDown, startTime) {
    var wrap = document.createElement("div");
    wrap.className = "uptime-bar-wrap";
    var bar = document.createElement("div");
    bar.className = "uptime-bar";
    bar.setAttribute("aria-label", "90-day uptime");
    var down = dailyMinutesDown || {};
    var start = startTime ? startOfDay(startTime) : startOfDay(new Date());

    for (var i = 89; i >= 0; i--) {
      var date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - i);
      var key = dayKey(date);
      var tick = document.createElement("span");
      if (date < start) {
        tick.className = "uptime-tick nodata";
        tick.title = key + " · No data";
      } else {
        var minutes = Number(down[key] || 0);
        tick.className = "uptime-tick " + tickClass(minutes);
        tick.title =
          key +
          (minutes > 0 ? " · " + minutes + " min down" : " · Operational");
      }
      bar.appendChild(tick);
    }

    var labels = document.createElement("div");
    labels.className = "uptime-bar-labels";
    labels.innerHTML = "<span>90 days ago</span><span>Today</span>";
    wrap.appendChild(bar);
    wrap.appendChild(labels);
    return wrap;
  }

  function stripHeroCheck(hero) {
    Array.prototype.forEach.call(hero.childNodes, function (node) {
      if (node.nodeType !== 3) return;
      node.textContent = node.textContent
        .replace(/✅/g, "")
        .replace(/^[\u00a0\s]+/, "");
    });
  }

  function hideDurationFilters() {
    var forms = document.querySelectorAll("form.f, form.r");
    Array.prototype.forEach.call(forms, function (form) {
      form.style.display = "none";
      var heading = form.closest("h3");
      if (heading) heading.style.display = "none";
    });
    Array.prototype.forEach.call(document.querySelectorAll("h3"), function (h3) {
      if (/live\s*status/i.test(h3.textContent || "")) {
        h3.style.display = "none";
      }
    });
  }

  function enhanceHero(sites) {
    var hero = document.querySelector("article.up:not(.link):not(.graph)");
    if (!hero) {
      hero = document.querySelector(
        "article.down:not(.link):not(.graph), article.degraded:not(.link):not(.graph)"
      );
    }
    if (!hero) return;
    stripHeroCheck(hero);
    if (hero.querySelector(".diwa-hero-meta")) {
      var overall = hero.querySelector(".diwa-overall");
      if (overall && sites.length) {
        overall.textContent =
          overallUptime(sites) + " uptime — last 90 days";
      }
      return;
    }

    var meta = document.createElement("div");
    meta.className = "diwa-hero-meta";
    meta.innerHTML =
      '<p class="diwa-checked">Last checked a few minutes ago – checks run automatically every 5 minutes</p>' +
      '<p class="diwa-overall">' +
      escapeHtml(overallUptime(sites)) +
      " uptime — last 90 days</p>" +
      '<div class="diwa-hero-actions"></div>';
    hero.appendChild(meta);

    var actions = meta.querySelector(".diwa-hero-actions");
    var rss = document.querySelector(".rss-subscribe");
    if (rss && actions) actions.appendChild(rss);
  }

  function isServiceArticle(article) {
    return (
      article &&
      article.tagName === "ARTICLE" &&
      article.classList.contains("graph") &&
      !article.classList.contains("link")
    );
  }

  function wrapServices() {
    var list = document.querySelector(".diwa-service-list");
    var loose = Array.prototype.filter.call(
      document.querySelectorAll("article.graph"),
      function (article) {
        return isServiceArticle(article) && !article.closest(".diwa-service-list");
      }
    );

    if (list) {
      loose.forEach(function (article) {
        if (article.parentNode !== list) list.appendChild(article);
      });
      return;
    }

    if (!loose.length) return;

    list = document.createElement("div");
    list.className = "diwa-service-list";
    loose[0].parentNode.insertBefore(list, loose[0]);
    loose.forEach(function (article) {
      list.appendChild(article);
    });
  }

  function siteForArticle(article, sites) {
    var heading = article.querySelector("h4");
    if (!heading) return null;
    var clone = heading.cloneNode(true);
    var extra = clone.querySelector(".diwa-service-uptime");
    if (extra) extra.parentNode.removeChild(extra);
    var name = clone.textContent.replace(/\s+/g, " ").trim();
    for (var i = 0; i < sites.length; i++) {
      if (sites[i].name && name.indexOf(sites[i].name) !== -1) return sites[i];
    }
    return null;
  }

  function enhanceServices(sites) {
    wrapServices();
    var cards = document.querySelectorAll(
      ".live-status article, .diwa-service-list article"
    );
    if (!cards.length) {
      cards = document.querySelectorAll("article.graph:not(.link)");
    }
    cards.forEach(function (article) {
      if (article.dataset.diwaEnhanced) return;
      var site = siteForArticle(article, sites);
      if (!site) return;
      article.dataset.diwaEnhanced = "1";

      var heading = article.querySelector("h4");
      var uptime = site.uptimeMonth || site.uptime || "100.00%";
      if (heading && !heading.querySelector(".diwa-service-uptime")) {
        var uptimeEl = document.createElement("span");
        uptimeEl.className = "diwa-service-uptime";
        uptimeEl.textContent = uptime + " uptime";
        heading.appendChild(uptimeEl);
      }

      var host = document.createElement("p");
      host.className = "diwa-service-host";
      host.textContent = hostnameFromUrl(site.url);
      if (heading) heading.insertAdjacentElement("afterend", host);
      article.appendChild(buildBar(site.dailyMinutesDown, site.startTime));
    });
  }

  function incidentNumber(article) {
    var link = article.querySelector("a[href*='incident']");
    if (!link) return null;
    var match = link.getAttribute("href").match(/incident\/(\d+)/);
    return match ? match[1] : null;
  }

  function enhanceIncidents() {
    var cards = document.querySelectorAll(
      "article.down.link, article.degraded.link"
    );
    cards.forEach(function (article) {
      if (article.dataset.diwaTimeline) return;
      var number = incidentNumber(article);
      if (!number) return;
      article.dataset.diwaTimeline = "loading";

      fetch(ISSUES_API + "/" + number + "/comments")
        .then(function (res) {
          return res.ok ? res.json() : [];
        })
        .then(function (comments) {
          if (!Array.isArray(comments) || !comments.length) {
            article.dataset.diwaTimeline = "empty";
            return;
          }
          var timeline = document.createElement("div");
          timeline.className = "diwa-timeline";
          comments.forEach(function (comment) {
            var item = document.createElement("div");
            item.className = "diwa-timeline-item";
            item.innerHTML =
              '<p class="diwa-timeline-when">' +
              escapeHtml(formatWhen(comment.created_at)) +
              "</p>" +
              '<div class="diwa-timeline-body">' +
              simpleMarkdown(comment.body || "") +
              "</div>";
            timeline.appendChild(item);
          });
          article.appendChild(timeline);
          article.dataset.diwaTimeline = "ready";
        })
        .catch(function () {
          article.dataset.diwaTimeline = "error";
        });
    });
  }

  function servicesReady() {
    var cards = document.querySelectorAll("article.graph:not(.link)");
    if (!cards.length) return false;
    for (var i = 0; i < cards.length; i++) {
      if (!cards[i].dataset.diwaEnhanced) return false;
    }
    return true;
  }

  function stopWatching() {
    done = true;
    if (observer) observer.disconnect();
    if (retryTimer) {
      clearInterval(retryTimer);
      retryTimer = null;
    }
  }

  function resumeWatching() {
    if (done || !observer || !observeRoot) return;
    observer.observe(observeRoot, { childList: true, subtree: true });
  }

  function enhance() {
    if (!isHome() || busy || done) return;
    busy = true;
    if (observer) observer.disconnect();
    hideDurationFilters();

    summaryPromise
      .then(function (sites) {
        var list = Array.isArray(sites) ? sites : [];
        return loadStartTimes(list).then(function () {
          enhanceHero(list);
          enhanceServices(list);
          enhanceIncidents();
          document.body.classList.add("diwa-ready");
          if (servicesReady()) {
            setTimeout(stopWatching, 1500);
          }
        });
      })
      .catch(function () {})
      .then(function () {
        busy = false;
        if (!done) resumeWatching();
      });
  }

  function start() {
    observeRoot = document.getElementById("sapper") || document.body;
    if (!observeRoot) {
      document.addEventListener("DOMContentLoaded", start);
      return;
    }

    observer = new MutationObserver(function () {
      if (!busy && !done) enhance();
    });

    enhance();
    resumeWatching();

    var tries = 0;
    retryTimer = setInterval(function () {
      tries += 1;
      if (done || tries >= 20) {
        stopWatching();
        return;
      }
      enhance();
    }, 500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
