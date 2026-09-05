/**
 * ============================================================
 * MANUAL TEST SCENARIO
 * ============================================================
 *
 * [CREATE]
 * Không áp dụng cho provider helper. Với CRUD page, dùng dữ liệu có prefix
 * AUDIT_TEST_<run-id> theo scenario của test file tương ứng.
 *
 * [READ]
 * Render component với QueryClient mới và xác nhận UI hiển thị dữ liệu từ API.
 *
 * [UPDATE]
 * Không áp dụng cho provider helper.
 *
 * [DELETE]
 * Không áp dụng cho provider helper.
 *
 * Account / Role: Không yêu cầu đăng nhập.
 * Expected result: Component render không dùng QueryClient production.
 * ============================================================
 */
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from './renderWithProviders'

function FixtureView() {
  return <h1>Admin audit test harness</h1>
}

describe('renderWithProviders', () => {
  it('renders a component with an isolated QueryClient', () => {
    renderWithProviders(<FixtureView />)
    expect(screen.getByRole('heading', { name: 'Admin audit test harness' })).toBeInTheDocument()
  })
})
