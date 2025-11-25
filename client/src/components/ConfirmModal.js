import React from 'react';

const ConfirmModal = ({ open, title, message, confirmText = 'Удалить', cancelText = 'Отмена', onConfirm, onCancel }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        {title && <h3 className="text-lg font-semibold mb-3">{title}</h3>}
        <p className="text-gray-700 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 border rounded text-gray-700">{cancelText}</button>
          <button onClick={onConfirm} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">{confirmText}</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
