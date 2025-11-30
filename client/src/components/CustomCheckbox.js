import React from 'react';

const CustomCheckbox = ({ checked = false, onChange = () => {}, disabled = false }) => {
  return (
    <div className="inline-flex items-center">
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        aria-checked={checked}
      />

      <div
        aria-hidden="true"
        className={
          `inline-flex items-center justify-center w-5 h-5 border rounded transition-colors ` +
          (checked ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-gray-300') +
          (disabled ? ' opacity-50' : '')
        }
      >
        {checked && (
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </div>
  );
};

export default CustomCheckbox;
