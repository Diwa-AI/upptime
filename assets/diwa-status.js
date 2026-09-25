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

  function currentPath() {
    var path = window.location.pathname || "/";
    return path.replace(/\/+$/, "") || "/";
  }

  function isHome() {
    var path = currentPath();
    return (
      path === "/" ||
      path === "/upptime" ||
      path === "/index.html" ||
      path === "/upptime/index.html"
    );
  }

  var observer = null;
  var retryTimer = null;
  var observeRoot = null;
  var busy = false;
  var done = false;
  var lastPath = null;
  var historyHooked = false;

  var summaryPromise = fetch(SUMMARY_URL)
    .then(function (res) {
      return res.ok ? res.json() : [];
    })
    .catch(function () {
      return [];
    });

  var issuesPromise = fetch(ISSUES_API + "?state=all&per_page=100")
    .then(function (res) {
      return res.ok ? res.json() : [];
    })
    .then(function (payload) {
      if (!Array.isArray(payload)) return [];
      return payload.map(normalizeIncident).filter(Boolean);
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

  function labelNames(issue) {
    return (issue.labels || [])
      .map(function (label) {
        return (label && label.name) || label;
      })
      .filter(Boolean);
  }

  function parseMetadata(body) {
    var meta = {};
    var match = String(body || "").match(/<!--([\s\S]*?)-->/);
    if (!match) return meta;
    match[1].split("\n").forEach(function (line) {
      var idx = line.indexOf(":");
      if (idx < 1) return;
      meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    });
    return meta;
  }

  function slugList(value) {
    if (!value) return [];
    return String(value)
      .split(",")
      .map(function (item) {
        return item.trim();
      })
      .filter(Boolean);
  }

  function daysBetween(start, end) {
    var days = [];
    var cursor = startOfDay(start);
    var last = startOfDay(end);
    if (last.getTime() < cursor.getTime()) last = new Date(cursor.getTime());
    while (cursor.getTime() <= last.getTime()) {
      days.push(dayKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }

  function normalizeIncident(issue) {
    if (!issue || issue.pull_request) return null;
    var labels = labelNames(issue);
    var isMaintenance = labels.indexOf("maintenance") !== -1;
    var isStatus = labels.indexOf("status") !== -1;
    if (!isMaintenance && !isStatus) return null;

    var meta = parseMetadata(issue.body);
    var start = meta.start ? new Date(meta.start) : new Date(issue.created_at);
    var end = meta.end
      ? new Date(meta.end)
      : issue.closed_at
        ? new Date(issue.closed_at)
        : new Date();
    if (isNaN(start.getTime())) start = new Date(issue.created_at);
    if (isNaN(end.getTime())) end = new Date();

    var slugs = slugList(meta.expectedDown);
    labels.forEach(function (name) {
      if (name === "diwa-ai" || name === "diwa-api") slugs.push(name);
    });
    slugs = slugs.filter(function (slug, index, list) {
      return list.indexOf(slug) === index;
    });

    var kind = "incident";
    if (isMaintenance) kind = "maintenance";
    else if (/down|outage/i.test(issue.title || "")) kind = "outage";
    else if (/degrad/i.test(issue.title || "")) kind = "degraded";

    return {
      number: issue.number,
      title: String(issue.title || "")
        .replace(/^\[[^\]]+\]\s*/, "")
        .replace(/^[🛑⚠️]\s*/u, "")
        .trim(),
      kind: kind,
      minutes: Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000)),
      days: daysBetween(start, end),
      slugs: slugs,
    };
  }

  function incidentsForSite(incidents, site) {
    var slug = site && site.slug;
    return (incidents || []).filter(function (incident) {
      if (!incident) return false;
      if (!incident.slugs.length) return true;
      return slug && incident.slugs.indexOf(slug) !== -1;
    });
  }

  function dayIncidentMap(incidents) {
    var map = {};
    (incidents || []).forEach(function (incident) {
      (incident.days || []).forEach(function (key) {
        if (!map[key]) map[key] = [];
        map[key].push(incident);
      });
    });
    return map;
  }

  function formatDayHeading(date) {
    try {
      return date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch (err) {
      return dayKey(date);
    }
  }

  function formatDuration(minutes) {
    var total = Math.max(0, Math.round(Number(minutes) || 0));
    return Math.floor(total / 60) + " hrs  " + (total % 60) + " mins";
  }

  function summaryLabel(kind, minutes) {
    if (kind === "maintenance") return "Scheduled maintenance";
    if (kind === "outage" || minutes >= 720) return "Major outage";
    if (kind === "degraded") return "Degraded performance";
    if (minutes > 0) return "Downtime";
    return "Operational";
  }

  function tickClass(minutes, incidents) {
    if (minutes >= 720) return "down";
    var hasOutage = (incidents || []).some(function (incident) {
      return incident.kind === "outage";
    });
    if (hasOutage) return "down";
    if (minutes > 0) return "degraded";
    if (incidents && incidents.length) return "degraded";
    return "up";
  }

  var tooltipEl = null;
  var tooltipHideTimer = null;

  function ensureTooltip() {
    if (tooltipEl) return tooltipEl;
    tooltipEl = document.createElement("div");
    tooltipEl.className = "uptime-tooltip";
    tooltipEl.hidden = true;
    document.body.appendChild(tooltipEl);
    return tooltipEl;
  }

  function hideTooltip() {
    if (tooltipHideTimer) clearTimeout(tooltipHideTimer);
    tooltipHideTimer = setTimeout(function () {
      if (tooltipEl) tooltipEl.hidden = true;
    }, 40);
  }

  function showTooltip(tick, html) {
    if (tooltipHideTimer) {
      clearTimeout(tooltipHideTimer);
      tooltipHideTimer = null;
    }
    var el = ensureTooltip();
    el.innerHTML = html;
    el.hidden = false;
    var rect = tick.getBoundingClientRect();
    var width = el.offsetWidth || 260;
    var left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
    el.style.left = left + "px";
    el.style.top = Math.max(8, rect.top - el.offsetHeight - 10) + "px";
  }

  function tooltipHtml(date, minutes, incidents) {
    var heading = formatDayHeading(date);
    var related = incidents || [];
    if (!related.length && minutes <= 0) {
      return (
        '<p class="uptime-tooltip-date">' +
        escapeHtml(heading) +
        "</p>" +
        '<p class="uptime-tooltip-status up">Operational</p>'
      );
    }
    var primary = related[0];
    var kind = primary ? primary.kind : minutes >= 720 ? "outage" : "degraded";
    var durationMinutes = minutes;
    if (!durationMinutes && primary) durationMinutes = primary.minutes;
    var tone = kind === "outage" || minutes >= 720 ? "down" : "degraded";
    var html =
      '<p class="uptime-tooltip-date">' +
      escapeHtml(heading) +
      "</p>" +
      '<p class="uptime-tooltip-status ' +
      tone +
      '"><span class="uptime-tooltip-icon" aria-hidden="true"></span>' +
      escapeHtml(summaryLabel(kind, durationMinutes)) +
      '<span class="uptime-tooltip-duration">' +
      escapeHtml(formatDuration(durationMinutes)) +
      "</span></p>";
    if (related.length) {
      html += '<p class="uptime-tooltip-related">Related</p><ul>';
      related.forEach(function (incident) {
        html += "<li>" + escapeHtml(incident.title || "Incident") + "</li>";
      });
      html += "</ul>";
    }
    return html;
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

  function buildBar(dailyMinutesDown, startTime, incidents) {
    var wrap = document.createElement("div");
    wrap.className = "uptime-bar-wrap";
    var bar = document.createElement("div");
    bar.className = "uptime-bar";
    bar.setAttribute("aria-label", "90-day uptime");
    var down = dailyMinutesDown || {};
    var byDay = dayIncidentMap(incidents);
    var start = startTime ? startOfDay(startTime) : startOfDay(new Date());

    for (var i = 89; i >= 0; i--) {
      var date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - i);
      var key = dayKey(date);
      var tick = document.createElement("span");
      if (date < start) {
        tick.className = "uptime-tick nodata";
        tick.setAttribute("aria-label", key + " · No data");
        tick.addEventListener(
          "mouseenter",
          (function (tickEl, dayDate) {
            return function () {
              showTooltip(
                tickEl,
                '<p class="uptime-tooltip-date">' +
                  escapeHtml(formatDayHeading(dayDate)) +
                  "</p>" +
                  '<p class="uptime-tooltip-status">No data</p>'
              );
            };
          })(tick, new Date(date.getTime()))
        );
        tick.addEventListener("mouseleave", hideTooltip);
      } else {
        var minutes = Number(down[key] || 0);
        var related = byDay[key] || [];
        tick.className = "uptime-tick " + tickClass(minutes, related);
        tick.setAttribute(
          "aria-label",
          key +
            (related.length
              ? " · " + related[0].title
              : minutes > 0
                ? " · " + minutes + " min down"
                : " · Operational")
        );
        tick.addEventListener(
          "mouseenter",
          (function (tickEl, dayDate, dayMinutes, dayIncidents) {
            return function () {
              showTooltip(tickEl, tooltipHtml(dayDate, dayMinutes, dayIncidents));
            };
          })(tick, new Date(date.getTime()), minutes, related)
        );
        tick.addEventListener("mouseleave", hideTooltip);
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

  function headingText(el) {
    return String((el && el.textContent) || "").replace(/\s+/g, " ").trim();
  }

  function findHeading(pattern) {
    var headings = document.querySelectorAll("h2");
    for (var i = 0; i < headings.length; i++) {
      if (pattern.test(headingText(headings[i]))) return headings[i];
    }
    return null;
  }

  function isActiveIncidentCard(el) {
    if (!el || el.tagName !== "ARTICLE") return false;
    if (el.classList.contains("graph") && !el.classList.contains("link")) {
      return false;
    }
    return (
      el.classList.contains("down-active") ||
      ((el.classList.contains("down") || el.classList.contains("degraded")) &&
        el.classList.contains("link"))
    );
  }

  function placeIncidentsAfterServices() {
    var live =
      document.querySelector(".diwa-service-list") ||
      document.querySelector(".live-status");
    if (!live) return;

    var activeHeading = findHeading(/^active incidents$/i);
    if (!activeHeading) return;

    var scheduledHeading = findHeading(/^past scheduled maintenance$/i);
    var parent = live.parentNode;
    var section = activeHeading.parentElement;
    if (
      section &&
      section.tagName === "SECTION" &&
      !section.classList.contains("live-status") &&
      section !== parent
    ) {
      if (live.nextElementSibling === section) return;
      if (scheduledHeading && section.contains(scheduledHeading)) return;
      parent.insertBefore(section, scheduledHeading || live.nextSibling);
      return;
    }

    if (live.nextElementSibling === activeHeading) return;

    var nodes = [activeHeading];
    var sibling = activeHeading.nextElementSibling;
    while (sibling && isActiveIncidentCard(sibling)) {
      nodes.push(sibling);
      sibling = sibling.nextElementSibling;
    }

    if (scheduledHeading) {
      nodes.forEach(function (node) {
        parent.insertBefore(node, scheduledHeading);
      });
      return;
    }
    nodes
      .slice()
      .reverse()
      .forEach(function (node) {
        parent.insertBefore(node, live.nextSibling);
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

  function enhanceServices(sites, incidents) {
    wrapServices();
    placeIncidentsAfterServices();
    var cards = serviceCards();
    cards.forEach(function (article) {
      if (article.querySelector(".uptime-bar-wrap")) return;
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

      if (!article.querySelector(".diwa-service-host")) {
        var host = document.createElement("p");
        host.className = "diwa-service-host";
        host.textContent = hostnameFromUrl(site.url);
        if (heading) heading.insertAdjacentElement("afterend", host);
      }
      article.appendChild(
        buildBar(
          site.dailyMinutesDown,
          site.startTime,
          incidentsForSite(incidents, site)
        )
      );
    });
  }

  function incidentNumber(article) {
    var link = article.querySelector("a[href*='incident']");
    if (!link) return null;
    var match = link.getAttribute("href").match(/incident\/(\d+)/);
    return match ? match[1] : null;
  }

  var STATUS_PREFIX =
    /^(Investigating|Identified|Monitoring|Resolved)\s*[-–—]\s*/i;

  function parseStatusUpdate(text) {
    var raw = String(text || "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .trim();
    if (!raw) return null;
    var match = raw.match(STATUS_PREFIX);
    if (!match) {
      return { status: "", body: raw };
    }
    return {
      status: match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase(),
      body: raw.slice(match[0].length).trim(),
    };
  }

  function formatUtcStamp(iso) {
    var date = new Date(iso);
    if (isNaN(date.getTime())) return "";
    var months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    var hh = String(date.getUTCHours()).padStart(2, "0");
    var mm = String(date.getUTCMinutes()).padStart(2, "0");
    return months[date.getUTCMonth()] + " " + date.getUTCDate() + ", " + hh + ":" + mm + " UTC";
  }

  function hasStatusPrefix(text) {
    return STATUS_PREFIX.test(
      String(text || "")
        .replace(/<!--[\s\S]*?-->/g, "")
        .trim()
    );
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

      Promise.all([
        fetch(ISSUES_API + "/" + number).then(function (res) {
          return res.ok ? res.json() : null;
        }),
        fetch(ISSUES_API + "/" + number + "/comments").then(function (res) {
          return res.ok ? res.json() : [];
        }),
      ])
        .then(function (results) {
          var issue = results[0];
          var comments = Array.isArray(results[1]) ? results[1] : [];
          var updates = [];
          if (issue && hasStatusPrefix(issue.body)) {
            var first = parseStatusUpdate(issue.body);
            if (first && first.body) {
              updates.push({
                status: first.status,
                body: first.body,
                at: issue.created_at,
              });
            }
          }
          comments.forEach(function (comment) {
            var parsed = parseStatusUpdate(comment.body);
            if (!parsed || !parsed.body) return;
            updates.push({
              status: parsed.status,
              body: parsed.body,
              at: comment.created_at,
            });
          });
          updates.sort(function (a, b) {
            return new Date(b.at).getTime() - new Date(a.at).getTime();
          });
          if (!updates.length) {
            article.dataset.diwaTimeline = "empty";
            return;
          }
          var timeline = document.createElement("div");
          timeline.className = "diwa-timeline";
          updates.forEach(function (update) {
            var item = document.createElement("div");
            item.className = "diwa-timeline-item";
            item.innerHTML =
              '<p class="diwa-timeline-body">' +
              (update.status
                ? "<strong>" + escapeHtml(update.status) + " - </strong>"
                : "") +
              simpleMarkdown(update.body) +
              "</p>" +
              '<p class="diwa-timeline-when">' +
              escapeHtml(formatUtcStamp(update.at)) +
              "</p>";
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

  function serviceCards() {
    var cards = document.querySelectorAll(
      ".live-status article, .diwa-service-list article"
    );
    if (!cards.length) {
      cards = document.querySelectorAll("article.graph:not(.link)");
    }
    return cards;
  }

  function servicesReady() {
    var cards = serviceCards();
    if (!cards.length) return false;
    for (var i = 0; i < cards.length; i++) {
      if (!cards[i].querySelector(".uptime-bar-wrap")) return false;
    }
    return true;
  }

  function pauseWatching() {
    if (observer) observer.disconnect();
    if (retryTimer) {
      clearInterval(retryTimer);
      retryTimer = null;
    }
  }

  function stopWatching() {
    done = true;
    if (retryTimer) {
      clearInterval(retryTimer);
      retryTimer = null;
    }
  }

  function resumeWatching() {
    if (done || !observer || !observeRoot) return;
    observer.observe(observeRoot, { childList: true, subtree: true });
  }

  function startRetryTimer() {
    if (retryTimer) {
      clearInterval(retryTimer);
      retryTimer = null;
    }
    var tries = 0;
    retryTimer = setInterval(function () {
      if (!isHome()) {
        pauseWatching();
        return;
      }
      tries += 1;
      if (done || tries >= 20) {
        stopWatching();
        return;
      }
      enhance();
    }, 500);
  }

  function beginHomeWatch() {
    done = false;
    busy = false;
    ensureObserver();
    enhance();
    resumeWatching();
    startRetryTimer();
  }

  function leaveHome() {
    done = true;
    pauseWatching();
    document.body.classList.remove("diwa-ready");
  }

  function onRouteChange() {
    var path = currentPath();
    if (path === lastPath) return;
    lastPath = path;
    if (isHome()) {
      beginHomeWatch();
    } else {
      leaveHome();
    }
  }

  function hookHistory() {
    if (historyHooked) return;
    historyHooked = true;
    var origPush = history.pushState;
    var origReplace = history.replaceState;
    history.pushState = function () {
      origPush.apply(this, arguments);
      onRouteChange();
    };
    history.replaceState = function () {
      origReplace.apply(this, arguments);
      onRouteChange();
    };
    window.addEventListener("popstate", onRouteChange);
  }

  function enhance() {
    if (!isHome() || busy || done) return;
    busy = true;
    if (observer) observer.disconnect();
    hideDurationFilters();

    summaryPromise
      .then(function (sites) {
        var list = Array.isArray(sites) ? sites : [];
        return Promise.all([loadStartTimes(list), issuesPromise]).then(
          function (results) {
            var loaded = results[0];
            var incidents = results[1] || [];
            enhanceHero(loaded);
            enhanceServices(loaded, incidents);
            enhanceIncidents();
            placeIncidentsAfterServices();
            document.body.classList.add("diwa-ready");
            if (servicesReady()) {
              setTimeout(function () {
                if (isHome()) stopWatching();
              }, 1500);
            }
          }
        );
      })
      .catch(function () {})
      .then(function () {
        busy = false;
        if (!done) resumeWatching();
      });
  }

  function ensureObserver() {
    observeRoot = document.getElementById("sapper") || document.body;
    if (!observeRoot) return false;
    if (!observer) {
      observer = new MutationObserver(function () {
        if (lastPath !== currentPath()) {
          onRouteChange();
          return;
        }
        if (!isHome()) return;
        placeIncidentsAfterServices();
        if (!busy && !done) enhance();
      });
    }
    return true;
  }

  function start() {
    if (!ensureObserver()) {
      document.addEventListener("DOMContentLoaded", start);
      return;
    }

    hookHistory();
    window.addEventListener("scroll", hideTooltip, true);
    window.addEventListener("resize", hideTooltip);
    lastPath = currentPath();
    if (isHome()) {
      beginHomeWatch();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
