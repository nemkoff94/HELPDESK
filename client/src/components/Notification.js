import React, { useEffect } from 'react';

const icons = {
  error: (
    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M21 12A9 9 0 1112 3a9 9 0 019 9z"></path>
    </svg>
  ),
  info: (
    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"></path>
    </svg>
  )
};

const Notification = ({ type = 'info', title, message, onClose, duration }) => {
  useEffect(() => {
    if (!onClose) return;
    const autoDuration = typeof duration === 'number' ? duration : (type === 'error' ? 8000 : 6000);
    if (autoDuration <= 0) return;
    const t = setTimeout(() => onClose(), autoDuration);
    return () => clearTimeout(t);
  }, [onClose, duration, type]);

  const base = 'flex items-start space-x-3 p-3 rounded-lg shadow-sm';
  const variants = {
    error: 'bg-red-50 border border-red-100 text-red-800',
    info: 'bg-blue-50 border border-blue-100 text-blue-800'
  };

  return (
    <div className={`${base} ${variants[type] || variants.info}`} role="alert">
      <div className="flex-shrink-0">{icons[type]}</div>
      <div className="flex-1 min-w-0 text-sm">
        {title && <div className="font-semibold text-sm mb-0.5">{title}</div>}
        <div className="leading-tight">{message}</div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="ml-3 p-1 rounded-md hover:bg-black/5 focus:outline-none"
          aria-label="Закрыть уведомление"
        >
          <svg className="w-4 h-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default Notification;
