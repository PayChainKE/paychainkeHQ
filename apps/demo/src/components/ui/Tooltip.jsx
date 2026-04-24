import React, { useState } from 'react'

export default function Tooltip({ children, tip }){
  const [show, setShow] = useState(false)
  
  if (!tip) return children

  return (
    <span 
      style={{position:'relative',display:'inline-block'}}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span style={{
          position:'absolute',
          left:'50%',
          transform:'translateX(-50%)',
          bottom:'120%',
          background:'#111',
          color:'white',
          padding:'6px 8px',
          borderRadius:6,
          whiteSpace:'nowrap',
          fontSize:12,
          zIndex:100,
          pointerEvents: 'none'
        }}>
          {tip}
        </span>
      )}
    </span>
  )
}
