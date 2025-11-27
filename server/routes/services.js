const express = require('express');
const { authenticateToken, requireRole } = require('./auth');

const router = express.Router();

// Получить все услуги
router.get('/', authenticateToken, (req, res) => {
  const db = req.db;
  db.all('SELECT * FROM services ORDER BY name ASC', [], (err, services) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка при получении услуг' });
    }
    res.json(services);
  });
});

// Получить услугу по ID
router.get('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const db = req.db;

  db.get('SELECT * FROM services WHERE id = ?', [id], (err, service) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка при получении услуги' });
    }
    if (!service) {
      return res.status(404).json({ error: 'Услуга не найдена' });
    }
    res.json(service);
  });
});

// Создать услугу
router.post('/', authenticateToken, requireRole('admin'), (req, res) => {
  const { name, description, price } = req.body;
  const db = req.db;

  if (!name || price === undefined || price === null) {
    return res.status(400).json({ error: 'Необходимо указать name и price' });
  }

  db.run(
    `INSERT INTO services (name, description, price, created_by)
     VALUES (?, ?, ?, ?)`,
    [name, description || null, parseFloat(price), req.user.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Ошибка при создании услуги' });
      }
      res.json({ id: this.lastID, name, description, price, created_by: req.user.id });
    }
  );
});

// Обновить услугу
router.put('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const { name, description, price } = req.body;
  const db = req.db;

  if (!name || price === undefined || price === null) {
    return res.status(400).json({ error: 'Необходимо указать name и price' });
  }

  db.run(
    `UPDATE services 
     SET name = ?, description = ?, price = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [name, description || null, parseFloat(price), id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Ошибка при обновлении услуги' });
      }
      res.json({ message: 'Услуга обновлена' });
    }
  );
});

// Удалить услугу
router.delete('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const db = req.db;

  db.run('DELETE FROM services WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Ошибка при удалении услуги' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Услуга не найдена' });
    }
    res.json({ message: 'Услуга удалена' });
  });
});

// Заказать услугу (создает тикет)
router.post('/:id/order', authenticateToken, (req, res) => {
  const { id } = req.params;
  const userRole = req.user.role;
  const db = req.db;

  if (userRole !== 'client') {
    return res.status(403).json({ error: 'Только клиенты могут заказывать услуги' });
  }

  const clientId = req.user.id;

  db.get('SELECT * FROM services WHERE id = ?', [id], (err, service) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка сервера' });
    }
    if (!service) {
      return res.status(404).json({ error: 'Услуга не найдена' });
    }

    db.run(
      `INSERT INTO tickets (client_id, title, description, status)
       VALUES (?, ?, ?, 'open')`,
      [clientId, 'Заказана услуга', service.name],
      function(ticketErr) {
        if (ticketErr) {
          return res.status(500).json({ error: 'Ошибка при создании тикета' });
        }

        const ticketId = this.lastID;

        db.run(
          `INSERT INTO service_orders (client_id, service_id, ticket_id)
           VALUES (?, ?, ?)`,
          [clientId, id, ticketId],
          function(orderErr) {
            if (orderErr) {
              return res.status(500).json({ error: 'Ошибка при создании заказа' });
            }

            res.json({
              id: this.lastID,
              service_id: id,
              ticket_id: ticketId,
              message: 'Услуга успешно заказана'
            });
          }
        );
      }
    );
  });
});

module.exports = router;
