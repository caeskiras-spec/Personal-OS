'use client'

import { createContext, useContext, useReducer, useEffect } from 'react'
import { supabase } from './supabase'
import { profileRepo } from './db/profile'
import { userModulesRepo } from './db/userModules'
import { AUTH_ENABLED } from './config'

const OSContext = createContext(null)

// DEV_BYPASS only active when AUTH_ENABLED = false
const DEV_BYPASS  = !AUTH_ENABLED && process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === 'true'
const DEV_USER_ID = process.env.NEXT_PUBLIC_DEV_USER_ID || 'dev-user-1'

const initialState = {
  userId: null,
  userName: '',
  activeModules: [],
  isBooted: false,
  isOnboarded: false,
  isLoading: true,
}

function osReducer(state, action) {
  switch (action.type) {
    case 'SET_USER_ID':
      return { ...state, userId: action.payload }
    case 'SET_USER_NAME':
      return { ...state, userName: action.payload }
    case 'SET_BOOTED':
      return { ...state, isBooted: action.payload }
    case 'SET_ONBOARDED':
      return { ...state, isOnboarded: action.payload }
    case 'SET_ACTIVE_MODULES':
      return { ...state, activeModules: action.payload }
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    case 'ADD_MODULE':
      if (state.activeModules.includes(action.payload)) return state
      return { ...state, activeModules: [...state.activeModules, action.payload] }
    case 'REMOVE_MODULE':
      return { ...state, activeModules: state.activeModules.filter(m => m !== action.payload) }
    case 'RESET':
      return { ...initialState, isLoading: false }
    default:
      return state
  }
}

async function loadForUser(userId, dispatch) {
  try {
    const [profile, modules] = await Promise.all([
      profileRepo.get(userId),
      userModulesRepo.list(userId),
    ])
    if (profile) {
      dispatch({ type: 'SET_ONBOARDED', payload: !!profile.onboarding_completed })
      dispatch({ type: 'SET_USER_NAME', payload: profile.username ?? '' })
    }
    if (modules.length > 0) {
      dispatch({ type: 'SET_ACTIVE_MODULES', payload: modules })
    }
  } catch (err) {
    console.error('[store] Failed to load user data:', err?.message ?? err)
  } finally {
    dispatch({ type: 'SET_LOADING', payload: false })
  }
}

export function OSProvider({ children }) {
  const [state, dispatch] = useReducer(osReducer, initialState)

  useEffect(() => {
    if (DEV_BYPASS) {
      dispatch({ type: 'SET_USER_ID', payload: DEV_USER_ID })
      loadForUser(DEV_USER_ID, dispatch)
      return
    }

    // Initial session check — .catch() ensures loading resolves even on cold-start failures
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (session?.user) {
          dispatch({ type: 'SET_USER_ID', payload: session.user.id })
          loadForUser(session.user.id, dispatch)
        } else {
          dispatch({ type: 'SET_LOADING', payload: false })
        }
      })
      .catch(() => {
        // Network failure (cold start / offline) — unblock loading so the app renders
        dispatch({ type: 'SET_LOADING', payload: false })
      })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        dispatch({ type: 'SET_USER_ID', payload: session.user.id })
        loadForUser(session.user.id, dispatch)
      } else if (event === 'SIGNED_OUT') {
        dispatch({ type: 'RESET' })
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const addModule = async (moduleId) => {
    dispatch({ type: 'ADD_MODULE', payload: moduleId })
    const updated = [...state.activeModules.filter(m => m !== moduleId), moduleId]
    try {
      await userModulesRepo.upsert(state.userId, moduleId, updated.length - 1)
    } catch (err) {
      console.error('[store] addModule write failed:', err?.message ?? err)
    }
  }

  const removeModule = async (moduleId) => {
    dispatch({ type: 'REMOVE_MODULE', payload: moduleId })
    try {
      await userModulesRepo.remove(state.userId, moduleId)
    } catch (err) {
      console.error('[store] removeModule write failed:', err?.message ?? err)
    }
  }

  const completeOnboarding = async (selectedModules, userName = '') => {
    dispatch({ type: 'SET_ONBOARDED', payload: true })
    dispatch({ type: 'SET_ACTIVE_MODULES', payload: selectedModules })
    if (userName) dispatch({ type: 'SET_USER_NAME', payload: userName })

    try {
      await profileRepo.upsert(state.userId, {
        username: userName || 'Пользователь',
        onboarding_completed: true,
      })
      await Promise.all(
        selectedModules.map((id, i) => userModulesRepo.upsert(state.userId, id, i))
      )
    } catch (err) {
      console.error('[store] completeOnboarding write failed:', err?.message ?? err)
    }
  }

  const reorderModules = async (newOrder) => {
    const prev = state.activeModules
    dispatch({ type: 'SET_ACTIVE_MODULES', payload: newOrder })
    try {
      await userModulesRepo.reorder(state.userId, newOrder)
    } catch (err) {
      console.error('[store] reorderModules failed:', err?.message ?? err)
      dispatch({ type: 'SET_ACTIVE_MODULES', payload: prev })
    }
  }

  const resetOS = () => {
    dispatch({ type: 'RESET' })
  }

  return (
    <OSContext.Provider value={{ ...state, dispatch, addModule, removeModule, completeOnboarding, resetOS, reorderModules }}>
      {children}
    </OSContext.Provider>
  )
}

export function useOS() {
  const ctx = useContext(OSContext)
  if (!ctx) throw new Error('useOS must be used inside OSProvider')
  return ctx
}
