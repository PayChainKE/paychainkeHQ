import React from 'react'

export default function CopyButton({ text }){
  async function copy(){
    try{ await navigator.clipboard.writeText(text); alert('Copied!') }catch(e){ alert('Copy failed') }
  }
  return <button onClick={copy} style={{background:'transparent',border:'1px solid #eee',padding:'6px 8px',borderRadius:6}}>Copy</button>
}
