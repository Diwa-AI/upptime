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

  function buildBar(dailyMinutesDown) {
    var wrap = document.createElement("div");
    wrap.className = "uptime-bar-wrap";
    var bar = document.createElement("div");
    bar.className = "uptime-bar";
    bar.setAttribute("aria-label", "90-day uptime");
    var down = dailyMinutesDown || {};

    for (var i = 89; i >= 0; i--) {
      var date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - i);
      var key = dayKey(date);
      var minutes = Number(down[key] || 0);
      var tick = document.createElement("span");
      tick.className = "uptime-tick " + (minutes > 0 ? "down" : "up");
      tick.title =
        key + (minutes > 0 ? " · " + minutes + " min down" : " · Operational");
      bar.appendChild(tick);
    }

    var labels = document.createElement("div");
    labels.className = "uptime-bar-labels";
    labels.innerHTML = "<span>90 days ago</span><span>Today</span>";
    wrap.appendChild(bar);
    wrap.appendChild(labels);
    return wrap;
  }

  function enhanceHero(sites) {
    var hero = document.querySelector(
      "article.up:not(.link):not(.graph)"
    );
    if (!hero) return;
    if (
      hero.querySelector(".diwa-hero-meta") ||
      (hero.nextElementSibling &&
        hero.nextElementSibling.classList.contains("diwa-hero-meta"))
    ) {
      return;
    }

    var meta = document.createElement("div");
    meta.className = "diwa-hero-meta";
    meta.innerHTML =
      '<p class="diwa-checked">Last checked a few minutes ago · checks run automatically every 5 minutes</p>' +
      '<p class="diwa-overall">' +
      escapeHtml(overallUptime(sites)) +
      " uptime — last 90 days</p>" +
      '<div class="diwa-hero-actions"></div>';
    hero.insertAdjacentElement("afterend", meta);

    var actions = meta.querySelector(".diwa-hero-actions");
    var rss = document.querySelector(".rss-subscribe");
    if (rss && actions) actions.appendChild(rss);
  }

  function siteForArticle(article, sites) {
    var heading = article.querySelector("h4");
    if (!heading) return null;
    var name = heading.textContent.replace(/\s+/g, " ").trim();
    for (var i = 0; i < sites.length; i++) {
      if (sites[i].name && name.indexOf(sites[i].name) !== -1) return sites[i];
    }
    return null;
  }

  function enhanceServices(sites) {
    var cards = document.querySelectorAll(".live-status article");
    cards.forEach(function (article) {
      if (article.dataset.diwaEnhanced) return;
      var site = siteForArticle(article, sites);
      if (!site) return;
      article.dataset.diwaEnhanced = "1";

      var meta = document.createElement("p");
      meta.className = "diwa-service-meta";
      var uptime = site.uptimeMonth || site.uptime || "100.00%";
      meta.textContent =
        hostnameFromUrl(site.url) + " · " + uptime + " uptime";
      var heading = article.querySelector("h4");
      if (heading) heading.insertAdjacentElement("afterend", meta);
      article.appendChild(buildBar(site.dailyMinutesDown));
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

  function enhance() {
    summaryPromise.then(function (sites) {
      var list = Array.isArray(sites) ? sites : [];
      enhanceHero(list);
      enhanceServices(list);
      enhanceIncidents();
    });
  }

  function start() {
    var root =
      document.getElementById("sapper") || document.body;
    if (!root) {
      document.addEventListener("DOMContentLoaded", start);
      return;
    }

    enhance();
    var observer = new MutationObserver(function () {
      enhance();
    });
    observer.observe(root, { childList: true, subtree: true });

    var tries = 0;
    var timer = setInterval(function () {
      enhance();
      tries += 1;
      if (tries >= 20) clearInterval(timer);
    }, 500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
