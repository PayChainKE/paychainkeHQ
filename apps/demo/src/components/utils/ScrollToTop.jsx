import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    // Scroll the window to the top
    window.scrollTo(0, 0)
    
    // Also scroll the MerchantLayout main container if needed
    const mainContent = document.getElementById('main-content-scroll-area')
    if (mainContent) {
      mainContent.scrollTo(0, 0)
    }
  }, [pathname])

  return null
}
