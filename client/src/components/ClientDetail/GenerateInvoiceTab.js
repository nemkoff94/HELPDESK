import React from 'react';

const GenerateInvoiceTab = ({ generateInvoiceData, previewPdfBase64, isGeneratingPreview, onInputChange, onGeneratePreview, onSaveInvoice, onCancelPreview }) => {
  return (
    <div className="max-w-md">
      <form onSubmit={onGeneratePreview} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Сумма (₽) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={generateInvoiceData.amount}
            onChange={(e) => onInputChange('amount', e.target.value)}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Наименование услуги <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={generateInvoiceData.serviceName}
            onChange={(e) => onInputChange('serviceName', e.target.value)}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Например: Поддержка сайта — декабрь 2025"
          />
        </div>
        <button
          type="submit"
          disabled={isGeneratingPreview}
          className="w-full bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 disabled:bg-gray-400"
        >
          {isGeneratingPreview ? 'Генерируется...' : 'Просмотреть счет'}
        </button>
      </form>

      {previewPdfBase64 && (
        <div className="mt-4 space-y-4">
          <div className="h-96 border rounded-lg overflow-hidden">
            <iframe
              title="Invoice preview"
              src={`data:application/pdf;base64,${previewPdfBase64}`}
              className="w-full h-full"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={onSaveInvoice}
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              Сохранить счет
            </button>
            <button
              onClick={onCancelPreview}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Вернуться
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GenerateInvoiceTab;
