import { APP_NAME } from '@/constants/app'

export function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="app-footer">
      <p>
        © {year} {APP_NAME}
      </p>
    </footer>
  )
}
