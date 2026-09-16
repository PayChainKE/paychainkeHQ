import React from 'react'
import Seo from '../components/Seo'

export default function Overview(){
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <Seo title="PayChain" description="PayChain merchant portal." path="/overview" noindex />
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-semibold mb-4">Dashboard Overview</h1>
        <div className="h-[80vh] border rounded-2xl overflow-hidden">
          <iframe src="http://localhost:8081/overview" title="PayChain Dashboard" className="w-full h-full" />
        </div>
      </div>
    </div>
  )
}
