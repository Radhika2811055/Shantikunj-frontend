const ToastStack = ({ toasts, onDismiss }) => {
  if (!Array.isArray(toasts) || toasts.length === 0) return null

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.type || 'info'}`}>
          <p>{toast.text}</p>
          <button type="button" onClick={() => onDismiss(toast.id)}>Dismiss</button>
        </div>
      ))}
    </div>
  )
}

export default ToastStack
