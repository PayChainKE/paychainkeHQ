import React from 'react'

export default function Tooltip({ children, tip }){
  return (
    <span style={{position:'relative',display:'inline-block'}}>
      {children}
      <span style={{position:'absolute',left:'50%',transform:'translateX(-50%)',bottom:'120%',background:'#111',color:'white',padding:'6px 8px',borderRadius:6,whiteSpace:'nowrap',fontSize:12,display:tip? 'inline-block':'none'}}>{tip}</span>
    </span>
  )
}
