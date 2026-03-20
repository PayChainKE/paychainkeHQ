import { useState } from 'react';

export default function useLocalStorage(key, initial){
  const [state, setState] = useState(()=>{
    try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : initial; }catch(e){ return initial; }
  });
  function set(value){
    try{ localStorage.setItem(key, JSON.stringify(value)); }catch(e){}
    setState(value);
  }
  return [state, set];
}
