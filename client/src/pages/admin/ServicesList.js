import React, { useState, useEffect } from 'react';
import api from '../../api';
import ConfirmModal from '../../components/ConfirmModal';

const ServicesList = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
  });
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState(null);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const response = await api.get('/services');
      setServices(response.data);
    } catch (error) {
      console.error('Ошибка при загрузке услуг:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setFormData({ name: '', description: '', price: '' });
    setEditingService(null);
    setShowAddServiceModal(true);
  };

  const handleOpenEditModal = (service) => {
    setFormData({
      name: service.name,
      description: service.description || '',
      price: service.price.toString(),
    });
    setEditingService(service);
    setShowEditModal(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddService = async (e) => {
    e.preventDefault();
    try {
      await api.post('/services', {
        name: formData.name,
        description: formData.description || null,
        price: parseFloat(formData.price),
      });
      setShowAddServiceModal(false);
      fetchServices();
      alert('Услуга успешно добавлена');
    } catch (error) {
      alert(error.response?.data?.error || 'Ошибка при добавлении услуги');
    }
  };

  const handleUpdateService = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/services/${editingService.id}`, {
        name: formData.name,
        description: formData.description || null,
        price: parseFloat(formData.price),
      });
      setShowEditModal(false);
      fetchServices();
      alert('Услуга успешно обновлена');
    } catch (error) {
      alert(error.response?.data?.error || 'Ошибка при обновлении услуги');
    }
  };

  const handleDeleteService = async () => {
    if (!serviceToDelete) return;
    try {
      await api.delete(`/services/${serviceToDelete.id}`);
      setShowConfirmDelete(false);
      setServiceToDelete(null);
      fetchServices();
      alert('Услуга удалена');
    } catch (error) {
      setShowConfirmDelete(false);
      setServiceToDelete(null);
      alert(error.response?.data?.error || 'Ошибка при удалении услуги');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Список услуг</h1>
        <button
          onClick={handleOpenAddModal}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          + Добавить услугу
        </button>
      </div>

      {services.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 mb-4">Услуги пока не добавлены</p>
          <button
            onClick={handleOpenAddModal}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
          >
            + Добавить первую услугу
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <div
              key={service.id}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                {service.name}
              </h3>
              {service.description && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-3">
                  {service.description}
                </p>
              )}
              <div className="flex items-end justify-between">
                <div className="text-2xl font-bold text-primary-600">
                  {service.price.toLocaleString('ru-RU')} ₽
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenEditModal(service)}
                    className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 text-sm"
                  >
                    Редактировать
                  </button>
                  <button
                    onClick={() => {
                      setServiceToDelete(service);
                      setShowConfirmDelete(true);
                    }}
                    className="bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 text-sm"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Модальное окно для добавления услуги */}
      {showAddServiceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Добавить услугу</h2>
            <form onSubmit={handleAddService}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Название <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleFormChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Название услуги"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Описание
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  placeholder="Описание услуги"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Стоимость (₽) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleFormChange}
                  step="0.01"
                  min="0"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
                >
                  Добавить
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddServiceModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно для редактирования услуги */}
      {showEditModal && editingService && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Редактировать услугу</h2>
            <form onSubmit={handleUpdateService}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Название <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleFormChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Описание
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Стоимость (₽) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleFormChange}
                  step="0.01"
                  min="0"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
                >
                  Сохранить
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно подтверждения удаления */}
      {showConfirmDelete && (
        <ConfirmModal
          open={showConfirmDelete}
          title="Удалить услугу"
          message={`Вы уверены, что хотите удалить услугу "${serviceToDelete?.name}"? Это действие нельзя отменить.`}
          confirmText="Удалить"
          cancelText="Отмена"
          onConfirm={handleDeleteService}
          onCancel={() => {
            setShowConfirmDelete(false);
            setServiceToDelete(null);
          }}
          isDangerous={true}
        />
      )}
    </div>
  );
};

export default ServicesList;
