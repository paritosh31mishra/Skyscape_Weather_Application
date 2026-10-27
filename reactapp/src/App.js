import React, { useEffect, useRef, useState } from 'react';
import './App.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5557';
const iconFor = (code) => code === 0 ? '☀' : code < 3 ? '🌤' : code < 50 ? '☁' : code < 70 ? '🌧' : '⛈';
const labelFor = (code) => ({0:'Clear sky',1:'Mostly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Rime fog',51:'Light drizzle',53:'Drizzle',55:'Dense drizzle',56:'Freezing drizzle',57:'Freezing drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',66:'Freezing rain',67:'Freezing rain',71:'Light snow',73:'Snow',75:'Heavy snow',77:'Snow grains',80:'Showers',81:'Rain showers',82:'Heavy showers',85:'Snow showers',86:'Heavy snow showers',95:'Thunderstorm',96:'Thunderstorm with hail',99:'Thunderstorm with hail'}[code] || 'Cloudy');
const kindFor = (code) => code === 0 ? 'clear' : code <= 2 ? 'partly-cloudy' : code === 3 || code === 45 || code === 48 ? 'cloudy' : code <= 67 || code === 80 || code === 81 || code === 82 ? 'rain' : code <= 86 ? 'snow' : 'storm';
const moonPhases = ['🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘'];
const moonNames = ['New moon','Waxing crescent','First quarter','Waxing gibbous','Full moon','Waning gibbous','Last quarter','Waning crescent'];
function getMoonPhase(time, utcOffset = 0) {
  const localAsUtc = new Date(`${time}Z`).getTime();
  const actualUtc = localAsUtc - utcOffset * 1000;
  const synodicMonth = 29.530588853;
  const newMoon = Date.UTC(2000, 0, 6, 18, 14);
  const age = ((actualUtc - newMoon) / 86400000 % synodicMonth + synodicMonth) % synodicMonth;
  const phase = Math.round(age / synodicMonth * 8) % 8;
  return { icon: moonPhases[phase], name: moonNames[phase] };
}
const formatClock = (time) => {
  const [hour, minute] = time.split('T')[1].split(':').map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
};
const formatHour = (time) => {
  const hour = Number(time.split('T')[1].split(':')[0]);
  return `${hour % 12 || 12} ${hour >= 12 ? 'PM' : 'AM'}`;
};
const formatDay = (date, firstDate) => date === firstDate ? 'Today' : new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' });

function LogoutIcon() {
  return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></svg>;
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('weatherToken'));
  const [user, setUser] = useState(localStorage.getItem('weatherName') || '');
  const [theme, setTheme] = useState(localStorage.getItem('weatherTheme') || 'light');
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [authLoading, setAuthLoading] = useState(false);
  const [authNotice, setAuthNotice] = useState('');
  const [city, setCity] = useState('Delhi');
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [unit, setUnit] = useState('C');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [favorites, setFavorites] = useState(JSON.parse(localStorage.getItem('weatherFavorites') || '[]'));
  const [locationMessage, setLocationMessage] = useState('');
  const placeChosenByUser = useRef(false);
  const hourlyScrollerRef = useRef(null);
  const [selectedHourlyDay, setSelectedHourlyDay] = useState('');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('weatherTheme', theme);
  }, [theme]);

  function toggleTheme() {
    setTheme(current => current === 'light' ? 'dark' : 'light');
  }

  const degree = (c) => Math.round(unit === 'C' ? c : c * 9 / 5 + 32);

  async function authenticate(event) {
    event.preventDefault();
    if (authLoading) return;
    setAuthLoading(true); setError(''); setAuthNotice('');
    try {
      const response = await fetch(`${API}/auth/${mode}`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not sign in');
      if (mode === 'signup') {
        setForm(current => ({ ...current, name: '', password: '' }));
        setMode('login');
        setAuthNotice('Your account was created. Please sign in to continue.');
        return;
      }
      localStorage.setItem('weatherToken', data.token); localStorage.setItem('weatherName', data.user.name);
      setToken(data.token); setUser(data.user.name);
    } catch (e) { setError(e.message); }
    finally { setAuthLoading(false); }
  }

  useEffect(() => {
    let alive = true;
    async function loadWeather() {
      setLoading(true); setError('');
      try {
        let place = selectedPlace;
        if (!place) {
          const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`).then(r => r.json());
          if (!geo.results?.length) throw new Error('We could not find that place. Try another one.');
          place = geo.results[0];
        }
        const data = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto&forecast_days=7`).then(r => r.json());
        if (!alive) return;
        setWeather({ ...data, place }); setForecast(data.daily.time.map((date, i) => ({ date, code:data.daily.weather_code[i], high:data.daily.temperature_2m_max[i], low:data.daily.temperature_2m_min[i] })));
        if (token) fetch(`${API}/weather`, {method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({city:place.name,temperature:data.current.temperature_2m,condition:labelFor(data.current.weather_code)})}).catch(() => {});
      } catch (e) { if (alive) { setError(e.message || 'Weather is temporarily unavailable.'); setWeather(null); } }
      finally { if (alive) setLoading(false); }
    }
    loadWeather(); const timer = setInterval(loadWeather, 10 * 60 * 1000);
    return () => { alive = false; clearInterval(timer); };
  }, [city, selectedPlace, token]);

  useEffect(() => {
    if (search.trim().length < 2) { setSearchResults([]); return undefined; }
    let alive = true;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(search.trim())}&count=8&language=en&format=json`);
        const data = await response.json();
        if (alive) setSearchResults(data.results || []);
      } catch (e) { if (alive) setSearchResults([]); }
    }, 300);
    return () => { alive = false; clearTimeout(timer); };
  }, [search]);

  useEffect(() => {
    if (!navigator.geolocation) { setLocationMessage('Location is not available in this browser.'); return; }
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      if (placeChosenByUser.current) return;
      setSelectedPlace({ name: 'Current location', latitude: coords.latitude, longitude: coords.longitude, country: '' });
      setCity('Current location');
      setLocationMessage('');
    }, () => setLocationMessage('Location access is off. Search for a place instead.'), { timeout: 10000, maximumAge: 300000 });
  }, []);

  function useMyLocation() {
    if (!navigator.geolocation) { setLocationMessage('Location is not available in this browser.'); return; }
    placeChosenByUser.current = true;
    setLocationMessage('Finding your location…');
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setSelectedPlace({ name: 'Current location', latitude: coords.latitude, longitude: coords.longitude, country: '' });
      setCity('Current location'); setLocationMessage('');
    }, () => setLocationMessage('Could not access your location. Check browser permissions.'), { timeout: 10000, maximumAge: 300000 });
  }

  function selectPlace(place) {
    placeChosenByUser.current = true;
    setSelectedPlace(place); setCity(place.name); setSearch(''); setSearchResults([]); setLocationMessage('');
  }

  function placeName(place) { return typeof place === 'string' ? place : place.name; }
  function isFavorite(place) { return favorites.some(item => typeof item === 'string' ? item === place.name : item.latitude === place.latitude && item.longitude === place.longitude); }
  function toggleFavorite(place) {
    const next = isFavorite(place)
      ? favorites.filter(item => typeof item === 'string' ? item !== place.name : item.latitude !== place.latitude || item.longitude !== place.longitude)
      : [...favorites, { name: place.name, admin1: place.admin1, country: place.country, latitude: place.latitude, longitude: place.longitude }];
    setFavorites(next); localStorage.setItem('weatherFavorites', JSON.stringify(next));
  }
  function logout() { localStorage.removeItem('weatherToken'); localStorage.removeItem('weatherName'); setToken(null); setUser(''); }
  const current = weather?.current;
  const isDay = current ? Boolean(current.is_day) : true;
  const weatherKind = current ? kindFor(current.weather_code) : 'clear';
  const moon = current && !isDay ? getMoonPhase(current.time, weather?.utc_offset_seconds) : null;
  const skyIcon = isDay ? (weatherKind === 'clear' ? '☀' : weatherKind === 'partly-cloudy' ? '🌤' : '') : moon.icon;
  const skyCloudIcon = weatherKind === 'cloudy' || weatherKind === 'partly-cloudy' ? '☁' : weatherKind === 'rain' ? '🌧' : weatherKind === 'snow' ? '❄' : weatherKind === 'storm' ? '⛈' : '';
  const skyCaption = !isDay ? `${moon ? moon.name : 'Night sky'}${weatherKind === 'clear' ? '' : ` · ${labelFor(current?.weather_code)}`}` : labelFor(current?.weather_code ?? 0);
  const hours = weather?.hourly ? weather.hourly.time.map((time, i) => ({time, temp:weather.hourly.temperature_2m[i], rain:weather.hourly.precipitation_probability[i], code:weather.hourly.weather_code[i]})).filter(x => x.time >= weather.current.time) : [];
  const hourlyDays = [...new Set(hours.map(hour => hour.time.slice(0, 10)))];
  const firstHourlyDay = hours[0]?.time.slice(0, 10) || '';
  const selectedDayHours = hours.filter(hour => hour.time.slice(0, 10) === selectedHourlyDay);
  const currentPlace = weather?.place || selectedPlace || { name: city };

  useEffect(() => {
    if (!weather?.hourly?.time?.length) return;
    const firstHour = weather.hourly.time.find(time => time >= weather.current.time);
    const selectedDayIsAvailable = weather.hourly.time.some(time => time >= weather.current.time && time.slice(0, 10) === selectedHourlyDay);
    if (firstHour && !selectedDayIsAvailable) {
      setSelectedHourlyDay(firstHour.slice(0, 10));
      hourlyScrollerRef.current?.scrollTo({ left: 0 });
    }
  }, [weather, selectedHourlyDay]);

  function chooseHourlyDay(date) {
    setSelectedHourlyDay(date);
    hourlyScrollerRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
  }

  function scrollHourlyTimeline(event) {
    const scroller = hourlyScrollerRef.current;
    if (!scroller || scroller.scrollWidth <= scroller.clientWidth) return;
    event.preventDefault();
    scroller.scrollLeft += Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
  }

  if (!token) return <main className="auth-shell"><section className="auth-art"><div className="brand"><span className="brand-mark">☼</span> Skyscape</div><div className="auth-copy"><p className="eyebrow">A clearer view of your day</p><h1>Weather that<br/>moves with you.</h1><p>Thoughtful forecasts for the places you call home.</p><div className="auth-sun">☀</div></div><div className="auth-foot">Made for your every day <span>✦</span></div></section><section className="auth-form-wrap"><button className="icon-btn theme-btn auth-theme-toggle" type="button" onClick={toggleTheme} title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'} aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>{theme === 'light' ? <span>&#9790;</span> : <span>&#9728;</span>}</button><form className="auth-form" onSubmit={authenticate}><span className="mobile-brand">☼ Skyscape</span><p className="eyebrow">YOUR PERSONAL FORECAST</p><h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2><p className="muted">{mode === 'login' ? 'Sign in to keep your favorite places close.' : 'Start planning your days with a little more clarity.'}</p>{mode === 'signup' && <label>Your name<input required disabled={authLoading} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Alex Morgan"/></label>}<label>Email address<input type="email" required disabled={authLoading} value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="you@example.com"/></label><label>Password<input type="password" required minLength="8" disabled={authLoading} value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="At least 8 characters"/></label>{error && <div className="error-msg">{error}</div>}{authNotice && <div className="success-msg" role="status">{authNotice}</div>}<button type="submit" className="primary-btn full" disabled={authLoading} aria-busy={authLoading}>{authLoading ? (mode === 'login' ? 'Signing in...' : 'Creating account...') : (mode === 'login' ? 'Sign in' : 'Create account')} {!authLoading && <span>&rarr;</span>}</button><p className="switch-auth">{mode === 'login' ? 'New to Skyscape?' : 'Already have an account?'} <button type="button" disabled={authLoading} onClick={()=>{setMode(mode === 'login' ? 'signup' : 'login');setError('');setAuthNotice('');}}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></p><p className="auth-note">Your account keeps your weather history private and secure.</p></form></section></main>;

  return <div className="app-shell"><aside className="sidebar"><div className="brand"><span className="brand-mark">☼</span> Skyscape</div><div className="side-label">MENU</div><button className="side-link active"><span>⌂</span> Overview</button><button className="side-link" onClick={()=>document.getElementById('forecast')?.scrollIntoView({behavior:'smooth'})}><span>▤</span> 7 day forecast</button><div className="side-label cities-label">YOUR PLACES <button onClick={()=>document.getElementById('city-search')?.focus()}>＋</button></div><div className="city-list">{favorites.map((c,i)=><button key={typeof c === 'string' ? c : `${c.latitude}-${c.longitude}-${i}`} className={`city-link ${city===placeName(c)?'selected':''}`} onClick={()=>typeof c === 'string' ? (setSelectedPlace(null),setCity(c)) : selectPlace(c)}><span className="city-dot"/>{placeName(c)}<span className="city-arrow">&gt;</span></button>)}</div><div className="sidebar-bottom"><div className="upgrade-card"><span>✦</span><b>Weather, your way</b><p>Save your favorite places for a quick forecast.</p></div><div className="profile"><div className="avatar">{user.charAt(0).toUpperCase()}</div><div><b>{user}</b><span>Personal account</span></div><button onClick={logout} aria-label="Log out" title="Log out"><LogoutIcon /></button></div></div></aside>
  <main className="main-content"><header className="topbar"><div><span className="breadcrumb">Weather <span>/</span> Overview</span><p className="today-date">{new Date().toLocaleDateString('en-IN',{weekday:'long',month:'long',day:'numeric'})}</p></div><div className="top-actions"><label className="search-box"><span>⌕</span><input id="city-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search any city or place"/><kbd>⌘ K</kbd>{search && <div className="search-results">{searchResults.map((place,i)=><button key={`${place.id || place.latitude}-${i}`} onClick={()=>selectPlace(place)}>{place.name}, {place.admin1 ? `${place.admin1}, ` : ''}{place.country}<span>&gt;</span></button>)}</div>}</label><button className="unit-toggle" onClick={()=>setUnit(unit==='C'?'F':'C')}><span className={unit==='C'?'unit-active':''}>°C</span><span className={unit==='F'?'unit-active':''}>°F</span></button><button className="icon-btn theme-btn" onClick={toggleTheme} title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'} aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>{theme === 'light' ? <span>&#9790;</span> : <span>&#9728;</span>}</button><button className="icon-btn" onClick={useMyLocation} title="Use my location" aria-label="Use my location">&#x2316;</button><button className="icon-btn logout-btn" onClick={logout} title="Log out" aria-label="Log out"><LogoutIcon /></button></div></header>
  <div className="page-heading"><div><p className="eyebrow">LIVE CONDITIONS</p><h1>Your weather, at a glance.</h1><p className="muted">A little sunshine goes a long way.</p></div><div className="refresh-note"><span className="live-dot"/> Updates every 10 minutes</div></div>
  {error && <div className="error-banner">{error}</div>}
  {locationMessage && <div className="location-message">{locationMessage}</div>}
  <section className={`hero-weather ${isDay ? 'day' : 'night'} ${weatherKind}`}><div className="hero-text"><div className="location-line"><span>⌖</span> {weather?.place?.name || city}{weather?.place?.admin1 ? `, ${weather.place.admin1}` : ''}<button className={isFavorite(currentPlace)?'fav marked':'fav'} onClick={()=>toggleFavorite(currentPlace)} aria-label="Toggle favorite">{isFavorite(currentPlace)?'Saved':'Save'}</button></div><div className="hero-temp">{loading && !current ? '—' : current ? degree(current.temperature_2m) : '—'}<span>°{unit}</span></div><p className="hero-condition">{current ? labelFor(current.weather_code) : loading ? 'Gathering your forecast…' : 'Weather unavailable'} <span>·</span> Feels like {current ? degree(current.apparent_temperature) : '—'}°</p><div className="hero-meta"><span>{isDay ? '\u2600 Daylight right now' : `${moon?.icon || '\u263e'} ${moon?.name || 'Night'}`}</span><span>↗ H:{weather ? degree(weather.daily.temperature_2m_max[0]) : '—'}°</span><span>↘ L:{weather ? degree(weather.daily.temperature_2m_min[0]) : '—'}°</span></div></div><div className="hero-art"><div className="sun-halo"/><div className="sky-orb">{skyIcon}</div><div className={`hero-cloud ${weatherKind}`}>{skyCloudIcon}</div><div className="art-caption">{skyCaption}<br/><small>{isDay ? 'Local daytime forecast' : 'Local nighttime forecast'}</small></div></div><div className="hero-footer"><span>◷ Local time · {weather ? formatClock(weather.current.time) : '—'}</span><span>✦ {weather?.place?.country || 'India'}</span></div></section>
  <section className="metrics-grid"><article className="metric-card"><div className="metric-top"><span>FEELS LIKE</span><i>♨</i></div><strong>{current ? degree(current.apparent_temperature) : '—'}°</strong><p>{current ? (current.apparent_temperature > current.temperature_2m ? 'A touch warmer outside' : 'Just like the air') : 'Loading conditions'}</p><div className="metric-line"><span style={{width:'66%'}}/></div></article><article className="metric-card"><div className="metric-top"><span>HUMIDITY</span><i>◉</i></div><strong>{current?.relative_humidity_2m ?? '—'}<small>%</small></strong><p>Relative humidity</p><div className="metric-line mint"><span style={{width:`${current?.relative_humidity_2m || 0}%`}}/></div></article><article className="metric-card"><div className="metric-top"><span>WIND</span><i>〰</i></div><strong>{current ? Math.round(current.wind_speed_10m) : '—'}<small> km/h</small></strong><p>Light breeze</p><div className="wind-direction"><span>↗</span> North easterly</div></article><article className="metric-card"><div className="metric-top"><span>PRECIPITATION</span><i>♧</i></div><strong>{current ? current.precipitation : '—'}<small> mm</small></strong><p>Today's rainfall</p><div className="rain-note">{current?.precipitation > 0 ? 'Rain in your area' : 'No rain expected right now'}</div></article></section>
  <section className="content-grid"><article className="panel hourly-panel"><div className="panel-heading"><div><p className="eyebrow">HOURLY FORECAST | NEXT 7 DAYS</p><h2>Hourly forecast</h2></div><input className="hourly-date-picker" type="date" aria-label="Choose forecast date" value={selectedHourlyDay} min={hourlyDays[0] || ''} max={hourlyDays[hourlyDays.length - 1] || ''} disabled={!hourlyDays.length} onChange={event => chooseHourlyDay(event.target.value)} /></div><div className="hourly-list" ref={hourlyScrollerRef} onWheel={scrollHourlyTimeline}>{selectedDayHours.length ? selectedDayHours.map((h,i)=><div className={`hour-item ${i===0?'now':''}`} data-date={h.time.slice(0,10)} key={h.time}><span className="hour-time">{i===0?'Now':formatHour(h.time)}</span><span className="hour-icon">{iconFor(h.code)}</span><b>{degree(h.temp)}&deg;</b><span className="hour-rain">{h.rain}%</span></div>) : <p className="hour-empty">{weather ? 'No hourly forecast for this date.' : 'Hourly forecast is loading...'}</p>}</div><div className="hour-legend"><span>◌ Chance of rain</span><span>All times local</span></div></article><article className="panel sun-panel"><div className="panel-heading"><div><p className="eyebrow">DAYLIGHT</p><h2>Sunrise & sunset</h2></div><span className="sun-icon">☀</span></div><div className="sun-times"><div><span className="sun-label">SUNRISE</span><b>{weather?formatClock(weather.daily.sunrise[0]):'—'}</b></div><div><span className="sun-label">SUNSET</span><b>{weather?formatClock(weather.daily.sunset[0]):'—'}</b></div></div><div className="sun-track"><span className="sun-track-icon">☀</span></div><p className="sun-sub">A little more daylight, a little more possibility.</p></article></section>
  <section className="panel forecast-panel" id="forecast"><div className="panel-heading"><div><p className="eyebrow">PLAN AHEAD</p><h2>7-day forecast</h2></div><span className="forecast-unit">°{unit}</span></div><div className="forecast-list">{forecast.map((day,i)=><div className="forecast-row" key={day.date}><b>{i===0?'Today':new Date(`${day.date}T12:00:00`).toLocaleDateString('en-IN',{weekday:'short'})}</b><span className="forecast-icon">{iconFor(day.code)}</span><span className="forecast-label">{labelFor(day.code)}</span><span className="forecast-range"><span>{degree(day.low)}°</span><i><span style={{left:`${20+i*8}%`,width:`${25+(i%3)*7}%`}}/></i><b>{degree(day.high)}°</b></span></div>)}</div></section>
  <footer className="app-footer"><span>☼ Skyscape <i>·</i> Weather for the days ahead</span><span>Powered by Open-Meteo</span></footer></main></div>;
}
export default App;

