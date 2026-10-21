// Weather from Open-Meteo (free, no API key).
(function (F) {
  // WMO weather codes -> [day icon, night icon, label]
  var CODES = {
    0: ['☀️', '🌙', 'Clear'],
    1: ['🌤️', '🌙', 'Mostly clear'],
    2: ['⛅', '☁️', 'Partly cloudy'],
    3: ['☁️', '☁️', 'Cloudy'],
    45: ['🌫️', '🌫️', 'Fog'], 48: ['🌫️', '🌫️', 'Freezing fog'],
    51: ['🌦️', '🌧️', 'Light drizzle'], 53: ['🌦️', '🌧️', 'Drizzle'], 55: ['🌧️', '🌧️', 'Heavy drizzle'],
    56: ['🌧️', '🌧️', 'Freezing drizzle'], 57: ['🌧️', '🌧️', 'Freezing drizzle'],
    61: ['🌦️', '🌧️', 'Light rain'], 63: ['🌧️', '🌧️', 'Rain'], 65: ['🌧️', '🌧️', 'Heavy rain'],
    66: ['🌧️', '🌧️', 'Freezing rain'], 67: ['🌧️', '🌧️', 'Freezing rain'],
    71: ['🌨️', '🌨️', 'Light snow'], 73: ['🌨️', '🌨️', 'Snow'], 75: ['❄️', '❄️', 'Heavy snow'],
    77: ['🌨️', '🌨️', 'Snow grains'],
    80: ['🌦️', '🌧️', 'Showers'], 81: ['🌧️', '🌧️', 'Showers'], 82: ['⛈️', '⛈️', 'Heavy showers'],
    85: ['🌨️', '🌨️', 'Snow showers'], 86: ['❄️', '❄️', 'Snow showers'],
    95: ['⛈️', '⛈️', 'Thunderstorm'], 96: ['⛈️', '⛈️', 'Thunderstorm & hail'], 99: ['⛈️', '⛈️', 'Thunderstorm & hail'],
  };

  function code(c, isDay) {
    var x = CODES[c] || ['🌡️', '🌡️', ''];
    return { icon: isDay === 0 ? x[1] : x[0], label: x[2] };
  }

  function load() {
    var w = F.cfg.weather || {};
    var url = 'https://api.open-meteo.com/v1/forecast'
      + '?latitude=' + w.latitude + '&longitude=' + w.longitude
      + '&current=temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m'
      + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max'
      + '&timezone=auto&forecast_days=5'
      + '&temperature_unit=' + (w.units === 'fahrenheit' ? 'fahrenheit' : 'celsius')
      + '&wind_speed_unit=' + (w.units === 'fahrenheit' ? 'mph' : 'kmh');

    return F.fetchJson(url).then(render).catch(function (err) {
      console.warn('weather', err);
      if (!F.el('weather').querySelector('.wx-now')) {
        F.el('weather').innerHTML = '<div class="muted">Weather unavailable</div>';
      }
    });
  }

  function render(d) {
    var w = F.cfg.weather || {};
    var cur = d.current, daily = d.daily;
    var now = code(cur.weather_code, cur.is_day);
    var windUnit = w.units === 'fahrenheit' ? 'mph' : 'km/h';

    var days = daily.time.slice(1, 5).map(function (t, i) {
      var idx = i + 1;
      var dt = new Date(t + 'T12:00:00');
      var c = code(daily.weather_code[idx], 1);
      var pop = daily.precipitation_probability_max && daily.precipitation_probability_max[idx];
      return '<div class="wx-day">'
        + '<div class="wx-dname">' + dt.toLocaleDateString([], { weekday: 'short' }) + '</div>'
        + '<div class="wx-dicon">' + c.icon + '</div>'
        + '<div class="wx-dtemp">' + Math.round(daily.temperature_2m_max[idx]) + '° <span class="muted">' + Math.round(daily.temperature_2m_min[idx]) + '°</span></div>'
        + (pop ? '<div class="wx-pop">💧' + pop + '%</div>' : '<div class="wx-pop">&nbsp;</div>')
        + '</div>';
    }).join('');

    F.el('weather').innerHTML =
      '<div class="wx-now">'
      + '<div class="wx-icon">' + now.icon + '</div>'
      + '<div>'
      + '<div class="wx-temp">' + Math.round(cur.temperature_2m) + '°</div>'
      + '<div class="wx-desc">' + F.esc(now.label) + '</div>'
      + '<div class="wx-meta muted">Feels ' + Math.round(cur.apparent_temperature) + '° · H ' + Math.round(daily.temperature_2m_max[0]) + '° L ' + Math.round(daily.temperature_2m_min[0]) + '° · 💨 ' + Math.round(cur.wind_speed_10m) + ' ' + windUnit + '</div>'
      + '</div>'
      + '</div>'
      + '<div class="wx-days">' + days + '</div>';
  }

  F.startWeather = function () {
    load();
    F.every((F.cfg.weather || {}).refreshMinutes || 15, load);
  };
})(window.Frame);
