import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'
import ProtectedRoute from './ProtectedRoute'
import { useAuth } from '../context/AuthContext'

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn()
}))

const renderRoute = () => {
  render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route path="/protected" element={<div>Protected Content</div>} />
        </Route>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/unauthorized" element={<div>Unauthorized Page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ProtectedRoute', () => {
  it('redirects unauthenticated users to login', () => {
    useAuth.mockReturnValue({
      isAuthenticated: false,
      user: null
    })

    renderRoute()
    expect(screen.getByText('Login Page')).toBeInTheDocument()
  })

  it('redirects unauthorized role users', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      user: { role: 'translator' }
    })

    renderRoute()
    expect(screen.getByText('Unauthorized Page')).toBeInTheDocument()
  })

  it('renders nested route for allowed roles', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      user: { role: 'admin' }
    })

    renderRoute()
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })
})
