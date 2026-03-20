import React from 'react'
export default function Skeleton({ width='100%', height=12, style }){
  return <div style={{width,height,background:'#eee',borderRadius:6,opacity:0.9,...style}} />
}
