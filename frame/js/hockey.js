// NHL scores with goal scorers. Uses the NHL's public feed (api-web.nhle.com) and
// falls back to ESPN's public scoreboard if the NHL feed can't be reached.
(function (F) {
  var H = (F.cfg.hockey = F.cfg.hockey || {});
  var state = {
    date: null,          // Date being shown
    games: [],
    index: 0,
    selectedId: null,
    lastTouch: 0,
    source: null,
  };
  var autoTimer = null, refreshTimer = null;

  // ESPN uses a few different abbreviations than the NHL.
  var ALIAS = { TB: 'TBL', NJ: 'NJD', LA: 'LAK', SJ: 'SJS', UTAH: 'UTA', WSH: 'WSH', MON: 'MTL' };
  function norm(a) { a = String(a || '').toUpperCase(); return ALIAS[a] || a; }
  var favorites = (H.favoriteTeams || []).map(norm);

  function ordinal(n) { return n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] || 'th'); }

  function periodLabel(num, type) {
    if (type === 'SO') return 'SO';
    if (type === 'OT' || num > 3) return num - 3 > 1 ? (num - 3) + 'OT' : 'OT';
    return ordinal(num);
  }

  function txt(v) { return v && typeof v === 'object' ? v.default : v; }

  // ---------- NHL feed ----------
  function loadNhl(date) {
    return F.fetchJson('https://api-web.nhle.com/v1/score/' + F.ymd(date), 15000).then(function (d) {
      return (d.games || []).map(function (g) {
        var st = g.gameState;
        var pd = g.periodDescriptor || {};
        var stateName = (st === 'LIVE' || st === 'CRIT') ? 'live'
          : (st === 'FINAL' || st === 'OFF') ? 'final' : 'pre';
        var start = new Date(g.startTimeUTC);
        var status;
        if (g.gameScheduleState && g.gameScheduleState !== 'OK') status = g.gameScheduleState === 'PPD' ? 'Postponed' : g.gameScheduleState;
        else if (stateName === 'final') {
          var last = (g.gameOutcome && g.gameOutcome.lastPeriodType) || pd.periodType;
          status = 'Final' + (last === 'OT' ? '/OT' : last === 'SO' ? '/SO' : '');
        } else if (stateName === 'live') {
          var clock = g.clock || {};
          status = periodLabel(pd.number, pd.periodType)
            + (clock.inIntermission ? ' Intermission' : (clock.timeRemaining ? ' · ' + clock.timeRemaining : ''));
        } else status = F.formatTime(start);

        function team(t) {
          return {
            abbrev: norm(t.abbrev), name: txt(t.name) || txt(t.placeName) || t.abbrev,
            score: t.score, sog: t.sog, logo: t.logo ? t.logo.replace('_light.svg', '_dark.svg') : '',
            logoFallback: t.logo || '',
          };
        }

        return {
          id: 'nhl-' + g.id, state: stateName, status: status, start: start,
          away: team(g.awayTeam), home: team(g.homeTeam),
          goals: (g.goals || []).map(function (x) {
            var gp = x.periodDescriptor || { number: x.period };
            var name = (txt(x.firstName) && txt(x.lastName)) ? txt(x.firstName) + ' ' + txt(x.lastName) : txt(x.name);
            var strength = String(x.strength || '').toUpperCase();
            var tags = [];
            if (strength && strength !== 'EV') tags.push(strength);
            if (x.goalModifier === 'empty-net') tags.push('EN');
            if (x.goalModifier === 'penalty-shot') tags.push('PS');
            return {
              period: periodLabel(gp.number, gp.periodType),
              time: gp.periodType === 'SO' ? '' : x.timeInPeriod,
              team: norm(txt(x.teamAbbrev)),
              scorer: name + (x.goalsToDate ? ' (' + x.goalsToDate + ')' : ''),
              assists: (x.assists || []).map(function (a) {
                return txt(a.name) + (a.assistsToDate ? ' (' + a.assistsToDate + ')' : '');
              }),
              tags: tags,
              unassisted: gp.periodType !== 'SO' && !(x.assists || []).length,
              score: (x.awayScore != null ? x.awayScore + '–' + x.homeScore : ''),
            };
          }),
        };
      });
    });
  }

  // ---------- ESPN fallback ----------
  function loadEspn(date) {
    var ds = F.ymd(date).replace(/-/g, '');
    return F.fetchJson('https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard?dates=' + ds, 15000).then(function (d) {
      return (d.events || []).map(function (e) {
        var comp = (e.competitions || [])[0] || {};
        var type = (e.status && e.status.type) || {};
        function side(which) {
          var c = (comp.competitors || []).filter(function (x) { return x.homeAway === which; })[0] || {};
          var t = c.team || {};
          return {
            id: t.id, abbrev: norm(t.abbreviation), name: t.shortDisplayName || t.displayName || t.abbreviation,
            score: type.state === 'pre' ? undefined : Number(c.score), logo: t.logo || '', logoFallback: '',
          };
        }
        var start = new Date(e.date);
        var game = {
          id: 'espn-' + e.id, espnId: e.id,
          state: type.state === 'in' ? 'live' : type.state === 'post' ? 'final' : 'pre',
          status: type.state === 'pre' ? F.formatTime(start) : (type.shortDetail || type.description || ''),
          start: start, away: side('away'), home: side('home'),
          goals: null,
        };
        if (game.state === 'pre') game.goals = [];
        return game;
      });
    });
  }

  function loadEspnGoals(game) {
    return F.fetchJson('https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary?event=' + game.espnId, 15000).then(function (d) {
      var plays = d.scoringPlays || (d.plays || []).filter(function (p) { return p.scoringPlay; });
      var teamById = {};
      [game.away, game.home].forEach(function (t) { teamById[t.id] = t.abbrev; });
      var playoffs = d.header && d.header.season && d.header.season.type === 3;
      game.goals = plays.map(function (p) {
        var n = (p.period && p.period.number) || 0;
        return {
          period: periodLabel(n, n === 5 && !playoffs ? 'SO' : null),
          time: p.clock && p.clock.displayValue,
          team: teamById[p.team && p.team.id] || '',
          scorer: p.text || '',
          assists: [], tags: [],
          score: p.awayScore != null ? p.awayScore + '–' + p.homeScore : '',
        };
      });
    }).catch(function () { game.goals = []; game.goalsError = true; });
  }

  // ---------- loading / ordering ----------
  function defaultDate() {
    var now = new Date();
    return now.getHours() < (H.showYesterdayUntilHour || 0) ? F.addDays(now, -1) : now;
  }

  function sortGames(games) {
    function fav(g) { return favorites.indexOf(g.away.abbrev) >= 0 || favorites.indexOf(g.home.abbrev) >= 0 ? 0 : 1; }
    function live(g) { return g.state === 'live' ? 0 : 1; }
    return games.sort(function (a, b) { return fav(a) - fav(b) || live(a) - live(b) || a.start - b.start; });
  }

  function load() {
    var date = state.date;
    var p = state.source === 'espn'
      ? loadEspn(date)
      : loadNhl(date).then(function (g) { state.source = 'nhl'; return g; }).catch(function (err) {
        console.warn('NHL feed failed, trying ESPN', err);
        return loadEspn(date).then(function (g) { state.source = 'espn'; return g; });
      });

    return p.then(function (games) {
      if (date !== state.date) return;     // user switched day while loading
      state.games = sortGames(games);
      var i = state.games.findIndex(function (g) { return g.id === state.selectedId; });
      state.index = i >= 0 ? i : 0;
      render();
      scheduleRefresh();
    }).catch(function (err) {
      console.warn('hockey', err);
      if (!state.games.length) F.el('hockey-card').innerHTML = '<div class="empty-sm">Scores unavailable right now</div>';
      scheduleRefresh();
    });
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    var anyLive = state.games.some(function (g) { return g.state === 'live'; });
    var soon = state.games.some(function (g) { return g.state === 'pre' && g.start - Date.now() < 15 * 60000; });
    var mins = (anyLive || soon) ? (H.refreshMinutesLive || 1) : (H.refreshMinutesIdle || 10);
    refreshTimer = setTimeout(function () {
      // After 15 idle minutes, drift back to the default day.
      if (Date.now() - state.lastTouch > 15 * 60000 && !F.sameDay(state.date, defaultDate())) {
        state.date = defaultDate();
        state.games = [];
        state.selectedId = null;
        renderDay();
      }
      load();
    }, mins * 60000);
  }

  // ---------- rendering ----------
  function logo(t, cls) {
    if (!t.logo) return '<div class="' + cls + ' logo-text">' + F.esc(t.abbrev) + '</div>';
    var fb = t.logoFallback && t.logoFallback !== t.logo ? "this.onerror=null;this.src='" + F.esc(t.logoFallback) + "'" : "this.style.visibility='hidden'";
    return '<img class="' + cls + '" src="' + F.esc(t.logo) + '" alt="' + F.esc(t.abbrev) + '" onerror="' + fb + '">';
  }

  function teamBlock(t, other, g) {
    var win = g.state === 'final' && t.score > other.score;
    var fav = favorites.indexOf(t.abbrev) >= 0;
    return '<div class="team' + (win ? ' winner' : '') + (fav ? ' fav' : '') + '">'
      + logo(t, 'team-logo')
      + '<div class="team-abbr">' + F.esc(t.abbrev) + '</div>'
      + '<div class="team-name">' + F.esc(t.name) + '</div>'
      + '</div>';
  }

  function goalsHtml(g) {
    if (g.state === 'pre') {
      return '<div class="empty-sm">Puck drop ' + F.dayLabel(g.start).toLowerCase() + ' at ' + F.formatTime(g.start) + '</div>';
    }
    if (g.goals === null) return '<div class="muted small center">Loading goals…</div>';
    if (!g.goals.length) return '<div class="empty-sm">' + (g.goalsError || g.state === 'final' ? 'Goal details unavailable' : 'No goals yet') + '</div>';

    var teams = {}; teams[g.away.abbrev] = g.away; teams[g.home.abbrev] = g.home;
    var out = '', lastPeriod = null;
    g.goals.forEach(function (x) {
      if (x.period !== lastPeriod) {
        out += '<div class="period">' + (x.period === 'SO' ? 'Shootout' : x.period === 'OT' || /OT$/.test(x.period) ? x.period : x.period + ' Period') + '</div>';
        lastPeriod = x.period;
      }
      var t = teams[x.team] || { abbrev: x.team };
      out += '<div class="goal">'
        + logo(t, 'goal-logo')
        + '<div class="goal-main">'
        + '<div class="goal-scorer">' + F.esc(x.scorer)
        + x.tags.map(function (tag) { return ' <span class="tag">' + F.esc(tag) + '</span>'; }).join('') + '</div>'
        + (x.assists.length ? '<div class="goal-ast">Assists: ' + F.esc(x.assists.join(', ')) + '</div>'
          : (x.unassisted ? '<div class="goal-ast">Unassisted</div>' : ''))
        + '</div>'
        + '<div class="goal-side"><div class="goal-time">' + F.esc(x.time || '') + '</div><div class="goal-score">' + F.esc(x.score) + '</div></div>'
        + '</div>';
    });
    return out;
  }

  function render() {
    var card = F.el('hockey-card');
    var dots = F.el('game-dots');
    var games = state.games;
    if (!games.length) {
      card.innerHTML = '<div class="empty-sm">No NHL games ' + (F.sameDay(state.date, new Date()) ? 'today' : 'on ' + F.dayLabel(state.date)) + '</div>';
      dots.innerHTML = '';
      return;
    }
    state.index = (state.index + games.length) % games.length;
    var g = games[state.index];
    state.selectedId = g.id;

    if (g.goals === null && g.espnId && !g.goalsLoading) {
      g.goalsLoading = true;
      loadEspnGoals(g).then(function () { g.goalsLoading = false; if (games[state.index] === g) render(); });
    }

    var hasScore = g.state !== 'pre';
    card.innerHTML = '<div class="game">'
      + '<div class="matchup">'
      + teamBlock(g.away, g.home, g)
      + '<div class="scorebox">'
      + (hasScore ? '<div class="score">' + g.away.score + '<span class="dash">–</span>' + g.home.score + '</div>' : '<div class="score vs">@</div>')
      + '<div class="status ' + g.state + '">' + (g.state === 'live' ? '<span class="live-dot"></span>' : '') + F.esc(g.status) + '</div>'
      + (hasScore && g.away.sog != null ? '<div class="sog muted">Shots ' + g.away.sog + '–' + g.home.sog + '</div>' : '')
      + '</div>'
      + teamBlock(g.home, g.away, g)
      + '</div>'
      + '<div class="goals">' + goalsHtml(g) + '</div>'
      + '</div>';
    card.scrollTop = 0;

    dots.innerHTML = games.map(function (x, i) {
      return '<button class="dot' + (i === state.index ? ' on' : '') + (x.state === 'live' ? ' live' : '') + '" data-i="' + i + '" aria-label="Game ' + (i + 1) + '">'
        + F.esc(x.away.abbrev) + '<br>' + F.esc(x.home.abbrev) + '</button>';
    }).join('');
    var on = dots.querySelector('.dot.on');
    if (on && on.scrollIntoView) on.scrollIntoView({ inline: 'center', block: 'nearest' });
  }

  function renderDay() {
    F.el('hockey-day').textContent = F.dayLabel(state.date);
  }

  function go(delta) {
    touched();
    if (!state.games.length) return;
    state.index += delta;
    render();
  }

  function shiftDay(delta) {
    touched();
    state.date = F.addDays(state.date, delta);
    state.games = [];
    state.selectedId = null;
    renderDay();
    F.el('hockey-card').innerHTML = '<div class="muted small center">Loading…</div>';
    F.el('game-dots').innerHTML = '';
    load();
  }

  function touched() {
    state.lastTouch = Date.now();
    resetAuto();
  }

  function resetAuto() {
    clearInterval(autoTimer);
    if (H.autoAdvanceSeconds > 0) {
      autoTimer = setInterval(function () {
        if (Date.now() - state.lastTouch > 60000 && state.games.length > 1) { state.index++; render(); }
      }, H.autoAdvanceSeconds * 1000);
    }
  }

  F.startHockey = function () {
    state.date = defaultDate();
    renderDay();
    F.el('game-prev').onclick = function () { go(-1); };
    F.el('game-next').onclick = function () { go(1); };
    F.el('hockey-day-prev').onclick = function () { shiftDay(-1); };
    F.el('hockey-day-next').onclick = function () { shiftDay(1); };
    F.el('game-dots').addEventListener('click', function (e) {
      var b = e.target.closest('.dot');
      if (!b) return;
      touched();
      state.index = Number(b.getAttribute('data-i'));
      render();
    });
    F.onSwipe(F.el('hockey-card'), function () { go(1); }, function () { go(-1); });
    resetAuto();
    load();
  };
})(window.Frame);
