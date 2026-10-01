import { useEffect, useState } from 'react'
import './App.css'

const popularCities = ['San Francisco', 'New York', 'London', 'Paris', 'Tokyo', 'Shanghai']
const weatherApi = 'https://api.open-meteo.com/v1/forecast'
const geocodingApi = 'https://geocoding-api.open-meteo.com/v1/search'

async function fetchJson(url, signal) {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error('Weather service is temporarily unavailable.')
  return response.json()
}

async function fetchForecast(latitude, longitude, signal) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m,visibility',
    hourly: 'temperature_2m,precipitation_probability,weather_code',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max,uv_index_max',
    forecast_days: '7',
    timezone: 'auto',
    wind_speed_unit: 'kmh',
  })
  return fetchJson(`${weatherApi}?${params}`, signal)
}

async function fetchCityForecast(cityName, signal) {
  const params = new URLSearchParams({ name: cityName, count: '1', language: 'en', format: 'json' })
  const geocoding = await fetchJson(`${geocodingApi}?${params}`, signal)
  const place = geocoding.results?.[0]
  if (!place) throw new Error(`No places found for “${cityName}”. Try another city.`)

  const forecast = await fetchForecast(place.latitude, place.longitude, signal)
  return {
    ...forecast,
    placeName: [place.name, place.country].filter(Boolean).join(', '),
  }
}

function getCondition(code, isDay = true) {
  if (code === 0) return { label: isDay ? 'Clear sky' : 'Clear night', icon: isDay ? 'sun' : 'moon' }
  if (code === 1) return { label: 'Mainly clear', icon: isDay ? 'sun' : 'moon' }
  if (code === 2) return { label: 'Partly cloudy', icon: 'cloud' }
  if (code === 3) return { label: 'Overcast', icon: 'cloud' }
  if (code === 45 || code === 48) return { label: 'Foggy', icon: 'cloud' }
  if (code >= 51 && code <= 57) return { label: 'Drizzle', icon: 'rain' }
  if (code >= 61 && code <= 67) return { label: 'Rain', icon: 'rain' }
  if (code >= 71 && code <= 77) return { label: 'Snow', icon: 'cloud' }
  if (code >= 80 && code <= 82) return { label: 'Rain showers', icon: 'rain' }
  if (code === 85 || code === 86) return { label: 'Snow showers', icon: 'cloud' }
  if (code >= 95) return { label: 'Thunderstorms', icon: 'rain' }
  return { label: 'Cloudy', icon: 'cloud' }
}

function formatLocalDateTime(value, options) {
  if (!value) return '--'
  const date = new Date(`${value.replace(' ', 'T')}Z`)
  return new Intl.DateTimeFormat('en', { timeZone: 'UTC', ...options }).format(date)
}

function getWindDirection(degrees = 0) {
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(degrees / 45) % 8]
}

function WeatherIcon({ name, className = '' }) {
  const common = { className: `weather-icon ${className}`, viewBox: '0 0 48 48', fill: 'none', 'aria-hidden': true }

  if (name === 'sun' || name === 'sunrise') {
    return <svg {...common}><circle cx="24" cy="23" r="8" /><path d="M24 4v5m0 28v5M4 23h5m30 0h5M10 9l4 4m20 20 4 4M38 9l-4 4M14 33l-4 4" /></svg>
  }
  if (name === 'moon') {
    return <svg {...common}><path d="M36 30.5A16 16 0 0 1 17.5 12 16 16 0 1 0 36 30.5Z" /></svg>
  }
  if (name === 'rain') {
    return <svg {...common}><path d="M13 29h21a8 8 0 0 0 0-16 12 12 0 0 0-23-2 9 9 0 0 0 2 18Z" /><path d="m18 35-2 5m12-5-2 5m12-5-2 5" /></svg>
  }
  return <svg {...common}><path d="M13 31h22a8 8 0 0 0 .5-16 12 12 0 0 0-23-2A9 9 0 0 0 13 31Z" /></svg>
}

function App() {
  const [query, setQuery] = useState('')
  const [city, setCity] = useState('My Location')
  const [unit, setUnit] = useState('C')
  const [weather, setWeather] = useState(null)
  const [request, setRequest] = useState({ type: 'city', value: 'Rabat' })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    async function loadWeather() {
      setIsLoading(true)
      setError('')
      try {
        const result = request.type === 'city'
          ? await fetchCityForecast(request.value, controller.signal)
          : {
              ...(await fetchForecast(request.latitude, request.longitude, controller.signal)),
              placeName: request.label,
            }
        if (active) {
          setWeather(result)
          setCity(result.placeName)
        }
      } catch (fetchError) {
        if (active && fetchError.name !== 'AbortError') setError(fetchError.message)
      } finally {
        if (active) setIsLoading(false)
      }
    }

    void loadWeather()
    return () => {
      active = false
      controller.abort()
    }
  }, [request])

  const temperature = (value) => {
    if (value == null || Number.isNaN(Number(value))) return '--°'
    return unit === 'C' ? `${Math.round(value)}°` : `${Math.round(value * 9 / 5 + 32)}°`
  }

  function chooseCity(nextCity) {
    setQuery('')
    setRequest({ type: 'city', value: nextCity })
  }

  function searchCity(event) {
    event.preventDefault()
    if (query.trim()) chooseCity(query.trim())
  }

  function useLocation() {
    if (!navigator.geolocation) {
      setError('Location is not available in this browser.')
      return
    }
    setIsLoading(true)
    setError('')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setRequest({
        type: 'coordinates',
        latitude: coords.latitude,
        longitude: coords.longitude,
        label: 'My Location',
      }),
      () => {
        setIsLoading(false)
        setError('Location access was not available. Search for a city instead.')
      },
      { timeout: 10000, enableHighAccuracy: false },
    )
  }

  const current = weather?.current
  const daily = weather?.daily
  const hourly = weather?.hourly
  const currentCondition = current ? getCondition(current.weather_code, current.is_day === 1) : null
  const currentTime = current?.time
  const hourlyStart = hourly?.time.findIndex((time) => time.slice(0, 13) >= currentTime?.slice(0, 13)) ?? -1
  const hourlyForecast = hourly && hourlyStart >= 0
    ? hourly.time.slice(hourlyStart, hourlyStart + 8).map((time, index) => ({
        time: index === 0 ? 'Now' : formatLocalDateTime(time, { hour: 'numeric' }),
        icon: getCondition(hourly.weather_code[hourlyStart + index], true).icon,
        temp: hourly.temperature_2m[hourlyStart + index],
        rain: hourly.precipitation_probability[hourlyStart + index],
      }))
    : []
  const weekForecast = daily?.time.map((date, index) => ({
    day: index === 0 ? 'Today' : formatLocalDateTime(`${date}T12:00`, { weekday: 'long' }),
    ...getCondition(daily.weather_code[index]),
    high: daily.temperature_2m_max[index],
    low: daily.temperature_2m_min[index],
    rain: daily.precipitation_probability_max[index],
  })) ?? []
  const locationDate = currentTime
    ? formatLocalDateTime(currentTime, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : 'Getting local forecast...'
  const sunrise = daily?.sunrise[0]
  const sunset = daily?.sunset[0]
  const currentRainChance = hourly && hourlyStart >= 0 ? hourly.precipitation_probability[hourlyStart] : null
  const windUnit = unit === 'C' ? 'km/h' : 'mph'

  return (
    <>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Aeris home">
          <span className="brand-mark"><WeatherIcon name="sun" /></span>
          <span>Aeris</span>
        </a>
        <nav className="main-nav" aria-label="Weather sections">
          <a href="#current">Now</a>
          <a href="#hourly">Hourly</a>
          <a href="#forecast">7-Day</a>
          <a href="#details">Details</a>
        </nav>
        <div className="unit-switch" aria-label="Temperature unit">
          <button type="button" className={unit === 'C' ? 'active' : ''} onClick={() => setUnit('C')} aria-pressed={unit === 'C'}>°C</button>
          <button type="button" className={unit === 'F' ? 'active' : ''} onClick={() => setUnit('F')} aria-pressed={unit === 'F'}>°F</button>
        </div>
      </header>

      <main id="top">
        <section className="intro" aria-labelledby="page-title">
          <p className="eyebrow"><span aria-hidden="true">◎</span> Live forecasts for every city on earth</p>
          <h1 id="page-title">Weather, crystal clear.</h1>
          <p className="intro-copy">Search any place, or use your location, to see current conditions, the next 24 hours, and a full 7-day outlook.</p>
          <form className="search-form" onSubmit={searchCity}>
            <button className="search-icon" type="submit" aria-label="Search city" />
            <input aria-label="Search for a city" placeholder="Search for a city..." value={query} onChange={(event) => setQuery(event.target.value)} />
            {query && <button className="clear-search" type="button" onClick={() => setQuery('')} aria-label="Clear search">×</button>}
            <button className="location-button" type="button" onClick={useLocation} disabled={isLoading}><span aria-hidden="true">⌖</span> My location</button>
          </form>
          {error && <p className="location-message" role="alert">{error}</p>}
          {isLoading && <p className="location-message" role="status">Fetching the latest forecast...</p>}
          <div className="popular-cities"><span className="popular-label">Popular</span>{popularCities.map((popularCity) => <button key={popularCity} type="button" onClick={() => chooseCity(popularCity)}>{popularCity}</button>)}</div>
        </section>

        <section className="current-weather" id="current" aria-label="Current weather">
          <img className="weather-backdrop" src="https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=2200&q=85" alt="Sunlight breaking through clouds over a calm landscape" />
          <div className="weather-shade" />
          <div className="current-topline">
            <div><h2>{city}</h2><p>{locationDate}{weather?.timezone ? ` · ${weather.timezone.replaceAll('_', ' ')}` : ''}</p></div>
            <span className="live-badge"><span className="live-dot" /> {isLoading ? 'Updating' : 'Live conditions'}</span>
          </div>
          <div className="current-main">
            <div className="temperature-block"><WeatherIcon name={currentCondition?.icon ?? 'cloud'} className="current-icon" /><div><p className="temperature">{temperature(current?.temperature_2m)}<span>{unit}</span></p><p className="condition">{currentCondition?.label ?? (isLoading ? 'Loading conditions' : 'Forecast unavailable')}</p></div></div>
            <div className="highlights"><div><span>Feels like</span><strong>{temperature(current?.apparent_temperature)}{unit}</strong></div><div><span>High</span><strong>{temperature(daily?.temperature_2m_max[0])}{unit}</strong></div><div><span>Low</span><strong>{temperature(daily?.temperature_2m_min[0])}{unit}</strong></div></div>
          </div>
          <div className="sun-data"><div><WeatherIcon name="sunrise" /><span>Sunrise <strong>{sunrise ? formatLocalDateTime(sunrise, { hour: 'numeric', minute: '2-digit' }) : '--'}</strong></span></div><div><WeatherIcon name="moon" /><span>Sunset <strong>{sunset ? formatLocalDateTime(sunset, { hour: 'numeric', minute: '2-digit' }) : '--'}</strong></span></div><div><span className="rain-drop">♢</span><span>Rain chance <strong>{currentRainChance == null ? '--' : `${currentRainChance}%`}</strong></span></div></div>
        </section>

        <section className="forecast-section hourly-section" id="hourly">
          <div className="section-heading"><div><p className="section-kicker">THE HOURS AHEAD</p><h2>Next 24 hours</h2></div><a href="#hourly" className="text-link">Hourly forecast <span aria-hidden="true">↗</span></a></div>
          <div className="hourly-list">{hourlyForecast.length ? hourlyForecast.map((hour, index) => <article className="hour-item" key={`${hour.time}-${index}`}><p>{hour.time}</p><WeatherIcon name={hour.icon} /><strong>{temperature(hour.temp)}<span>{unit}</span></strong><span className="hour-rain">{hour.rain}%</span></article>) : <p className="forecast-empty">{isLoading ? 'Loading hourly forecast...' : 'Hourly forecast is unavailable.'}</p>}</div>
        </section>

        <section className="forecast-section week-section" id="forecast">
          <div className="section-heading"><div><p className="section-kicker">PLAN YOUR WEEK</p><h2>7-day forecast</h2></div><span className="forecast-note">{weather?.generationtime_ms != null ? 'Updated just now' : 'Waiting for forecast'}</span></div>
          <div className="week-list">{weekForecast.length ? weekForecast.map((day) => <article className="week-row" key={day.day}><strong className="week-day">{day.day}</strong><WeatherIcon name={day.icon} /><span className="week-condition">{day.label}</span><span className="week-rain">{day.rain}%</span><div className="week-range"><strong>{temperature(day.high)}{unit}</strong><span className="range-track"><i style={{ left: `${Math.max(0, Math.min(80, (day.low - 5) * 2))}%`, right: `${Math.max(0, Math.min(80, (35 - day.high) * 2))}%` }} /></span><span>{temperature(day.low)}{unit}</span></div></article>) : <p className="forecast-empty">{isLoading ? 'Loading 7-day forecast...' : 'Forecast is unavailable.'}</p>}</div>
        </section>

        <section className="details-section" id="details">
          <div className="section-heading"><div><p className="section-kicker">AT A GLANCE</p><h2>Weather details</h2></div></div>
          <div className="details-grid"><article><span>Humidity</span><strong>{current?.relative_humidity_2m ?? '--'}%</strong><small>Relative humidity</small></article><article><span>Wind</span><strong>{current ? Math.round(unit === 'C' ? current.wind_speed_10m : current.wind_speed_10m / 1.609) : '--'} <small>{windUnit}</small></strong><small>{current ? `From the ${getWindDirection(current.wind_direction_10m)}` : 'Surface wind'}</small></article><article><span>Visibility</span><strong>{current?.visibility != null ? (current.visibility / 1000).toFixed(1) : '--'} <small>km</small></strong><small>Horizontal visibility</small></article><article><span>UV index</span><strong>{daily?.uv_index_max[0]?.toFixed(1) ?? '--'} <small>of 11</small></strong><small>Today's maximum</small></article></div>
        </section>
      </main>
      <footer><a className="footer-brand" href="#top">Aeris</a><span>Clear skies, wherever you are.</span><span>{currentTime ? formatLocalDateTime(currentTime, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'Weather by Open-Meteo'}</span></footer>
    </>
  )
}

export default App
