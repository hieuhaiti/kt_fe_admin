import React from 'react'
import Switch from 'react-switch'
import { Sun, Moon } from 'lucide-react'
import Cookies from 'js-cookie'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const ThemeSwitch: React.FC = () => {
  const getInitialTheme = () => {
    const cookieTheme = Cookies.get('theme')
    if (cookieTheme === 'dark') return true
    if (cookieTheme === 'light') return false
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  const [dark, setDark] = React.useState<boolean>(getInitialTheme)

  const handleChange = (checked: boolean) => {
    setDark(checked)
  }

  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    Cookies.set('theme', dark ? 'dark' : 'light', { expires: 365 })
  }, [dark])

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2">
          <Switch
            checked={dark}
            onChange={handleChange}
            onColor="#3352b8"
            offColor="#14b8a6"
            onHandleColor="#fff"
            offHandleColor="#fff"
            handleDiameter={24}
            uncheckedIcon={
              <div className="flex h-full items-center justify-center">
                <Sun className="h-4 w-4 text-white" />
              </div>
            }
            checkedIcon={
              <div className="flex h-full items-center justify-center">
                <Moon className="h-4 w-4 text-white" />
              </div>
            }
            boxShadow="0px 1px 3px rgba(0, 0, 0, 0.2)"
            activeBoxShadow="0px 0px 1px 5px rgba(99, 102, 241, 0.2)"
            height={28}
            width={56}
            className="react-switch"
            aria-label="Toggle theme"
          />
        </div>
      </TooltipTrigger>
      <TooltipContent>{dark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}</TooltipContent>
    </Tooltip>
  )
}

export default ThemeSwitch
