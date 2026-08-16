import React from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import App from './App'
import './index.css'
import './lib/sentry'

// Tag every outbound API call so the admin audit log can split web vs mobile.
// Set once at boot — applies to all axios callers in the app.
axios.defaults.headers.common['X-Client-Platform'] = 'web'

const container = document.getElementById('root')
const root = createRoot(container)
root.render(
	<React.StrictMode>
		<App />
	</React.StrictMode>
)
