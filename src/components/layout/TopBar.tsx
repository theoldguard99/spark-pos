import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LogOut, ChevronDown, Clock, MapPin, Cloud } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'

const MANILA_LAT = 14.5995
const MANILA_LON = 120.9842

function weatherCodeToDescription(code: number): string {
  if (code === 0) return 'Clear'
  if (code >= 1 && code <= 3) return 'Partly cloudy'
  if (code === 45 || code === 48) return 'Foggy'
  if (code >= 51 && code <= 67) return 'Rain'
  if (code >= 71 && code <= 77) return 'Snow'
  if (code >= 80 && code <= 82) return 'Showers'
  if (code === 95) return 'Thunderstorm'
  if (code >= 96 && code <= 99) return 'Thunderstorm'
  return 'Clear'
}

interface TopBarProps {
  title: string
}

interface ProfileAvatarRow {
  avatar_url: string | null
}

export default function TopBar({ title }: TopBarProps) {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const [location, setLocation] = useState<string | null>(null)
  const [weather, setWeather] = useState<{ temp: number; description: string } | null>(null)

  const dateStr = currentTime.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const timeStr = currentTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    let lat = MANILA_LAT
    let lon = MANILA_LON
    let resolved = false

    function fetchWeather(latitude: number, longitude: number) {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code`
      fetch(url)
        .then((res) => res.json())
        .then((data) => {
          const cur = data?.current
          if (cur != null && typeof cur.temperature_2m === 'number') {
            setWeather({
              temp: Math.round(cur.temperature_2m),
              description: weatherCodeToDescription(cur.weather_code ?? 0),
            })
          }
        })
        .catch(() => {})
    }

    function fetchLocationName(latitude: number, longitude: number) {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
      fetch(url, {
        headers: { 'User-Agent': 'SPARK-POS/1.0' },
      })
        .then((res) => res.json())
        .then((data) => {
          const city = data?.address?.city ?? data?.address?.town ?? data?.address?.municipality ?? data?.address?.state
          const country = data?.address?.country
          if (city || country) {
            setLocation([city, country].filter(Boolean).join(', '))
          } else {
            setLocation('Unknown')
          }
        })
        .catch(() => setLocation(null))
    }

    if (!navigator.geolocation) {
      setLocation('Manila, Philippines')
      fetchWeather(lat, lon)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (resolved) return
        resolved = true
        lat = pos.coords.latitude
        lon = pos.coords.longitude
        fetchLocationName(lat, lon)
        fetchWeather(lat, lon)
      },
      () => {
        if (resolved) return
        resolved = true
        setLocation('Manila, Philippines')
        fetchWeather(MANILA_LAT, MANILA_LON)
      },
      { timeout: 5000, maximumAge: 300000 }
    )
  }, [])

  const firstName = (user?.user_metadata?.first_name as string | undefined)?.trim() ?? ''
  const lastName = (user?.user_metadata?.last_name as string | undefined)?.trim() ?? ''
  const fullNameFromMetadata = `${firstName} ${lastName}`.trim()
  const fullNameFallback = (user?.user_metadata?.full_name as string | undefined)?.trim() ?? ''
  const displayName =
    fullNameFromMetadata ||
    fullNameFallback ||
    user?.email?.split('@')[0] ||
    'Admin'
  const displayEmail = user?.email ?? null
  const initials = (displayName?.[0] ?? 'A').toUpperCase()

  const avatarQuery = useQuery({
    queryKey: ['topbar-avatar', user?.id],
    enabled: Boolean(isSupabaseConfigured && user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user!.id)
        .single<ProfileAvatarRow>()

      if (error) {
        if (error.code === 'PGRST116') return { avatar_url: null } as ProfileAvatarRow
        throw error
      }

      return data
    },
  })

  const avatarUrl = avatarQuery.data?.avatar_url ?? null

  async function handleSignOut() {
    navigate('/')
    await signOut()
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
      <div>
        <h1 className="text-xl font-bold text-slate-800">{title}</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-500">
          <span>{dateStr}</span>
          <span className="flex items-center gap-1">
            <Clock size={12} className="text-slate-400" />
            {timeStr}
          </span>
          {location != null && (
            <span className="flex items-center gap-1">
              <MapPin size={12} className="text-slate-400" />
              {location}
            </span>
          )}
          {weather != null && (
            <span className="flex items-center gap-1">
              <Cloud size={12} className="text-slate-400" />
              {weather.temp}°C · {weather.description}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 pl-2 pr-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-semibold">{initials}</span>
              )}
            </div>
            <span className="text-sm font-medium text-slate-700 hidden md:block capitalize">
              {displayName}
            </span>
            <ChevronDown size={14} className={`text-slate-400 hidden md:block transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-lg border border-slate-100 py-1.5 z-50">
              {isSupabaseConfigured && displayEmail && (
                <div className="px-4 py-2.5 border-b border-slate-100 mb-1">
                  <p className="text-xs font-medium text-slate-700 truncate">{displayEmail}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Signed in</p>
                </div>
              )}
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut size={15} />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
