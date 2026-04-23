export function sanitizePastedHtml(html) {
  const temp = document.createElement('div')
  temp.innerHTML = html
  temp.querySelectorAll('script,style,meta,link,title,o\\:p').forEach(el => el.remove())
  temp.querySelectorAll('font').forEach(el => {
    const parent = el.parentNode
    while (el.firstChild) parent.insertBefore(el.firstChild, el)
    parent.removeChild(el)
  })
  const STRIP_PROPS = ['font-family', 'font-size', 'font', 'color', 'background', 'background-color', 'line-height', 'letter-spacing']
  temp.querySelectorAll('[style]').forEach(el => {
    STRIP_PROPS.forEach(p => el.style.removeProperty(p))
    if (!el.getAttribute('style')?.trim()) el.removeAttribute('style')
  })
  temp.querySelectorAll('[class]').forEach(el => {
    const cls = el.className
    if (typeof cls === 'string' && /\b(re-checklist|re-checked)\b/.test(cls)) return
    el.removeAttribute('class')
  })
  return temp.innerHTML
}
