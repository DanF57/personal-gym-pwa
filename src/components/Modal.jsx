import { useEffect } from 'react'
import './Modal.css'

export default function Modal({ open, onClose, title, children, fullScreen = false }) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const overlayClass = `modal-overlay${fullScreen ? ' modal-overlay--full' : ''}`
  const contentClass = `modal-content${fullScreen ? ' modal-content--full' : ''}`

  return (
    <div className={overlayClass} onClick={onClose}>
      <div className={contentClass} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  )
}
