export type DashboardUser = {
  id: string
  email: string
  role: string
  lastLoginAt?: string
}

export type AuthContextValue = {
  user: DashboardUser | null
  loading: boolean
  error: string | null
  refreshSession: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}
