export default function useDebounce(value, delay = 500){
  const [v, setV] = require('react').useState(value)
  require('react').useEffect(()=>{
    const t = setTimeout(()=>setV(value), delay)
    return ()=>clearTimeout(t)
  },[value,delay])
  return v
}
