# 🏗️ ARCHITECTURE.md - Архитектурная документация

## Архитектура системы

```
┌─────────────────────────────────────────────────────────────┐
│                    BROWSER (React 19)                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                      App.tsx                           │ │
│  │  - Router с защитой маршрутов                          │ │
│  │  - AuthContext wrapper                                 │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                     Axios (api.js)
                            │
                    JWT Token in headers
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
┌───────▼──────────────────┐      ┌────────────▼──────────────┐
│   NGINX (Production)     │      │  localhost:5001 (Dev)     │
│   ┌──────────────────┐   │      │                          │
│   │  Port 80/443     │   │      │  Express.js Server       │
│   │  SSL Termination │   │      │  ┌────────────────────┐ │
│   │  SPA Routing     │   │      │  │  CORS Middleware   │ │
│   │  API Proxy       │   │      │  ├────────────────────┤ │
│   └──────────────────┘   │      │  │  JWT Verification  │ │
└────────────────────────────┘      │  ├────────────────────┤ │
          │                         │  │  Role Checking     │ │
          └─────────────────────────▶│  ├────────────────────┤ │
                                    │  │  Route Handlers    │ │
                                    │  └────────────────────┘ │
                                    │         │               │
                                    │    ┌────▼─────┐         │
                                    │    │ SQLite   │         │
                                    │    │ helpdesk.│         │
                                    │    │   db     │         │
                                    │    └──────────┘         │
                                    │         │               │
                                    │    ┌────▼─────┐         │
                                    │    │ /uploads │         │
                                    │    │/invoices │         │
                                    │    └──────────┘         │
                                    └──────────────────────────┘
```

---

## Frontend Component Hierarchy

```
<App>
  <AuthProvider>
    <Router>
      <Layout>
        <Header/>
        <Routes>
          ├─ <Login/>
          │
          ├─ /admin/* (PROTECTED)
          │  ├─ <AdminClientsList/>
          │  │  └─ ClientCard[] → ClientDetail
          │  ├─ <AdminClientDetail/>
          │  │  └─ Tabs: Info|Tickets|Invoices|Tasks
          │  │     ├─ NewClient Form
          │  │     ├─ TicketsList → TicketDetail
          │  │     ├─ InvoicesList → GenerateInvoice
          │  │     └─ TasksList → TaskDetail
          │  ├─ <AdminTicketDetail/>
          │  │  └─ Comments[] + CommentForm
          │  ├─ <AdminTaskDetail/>
          │  │  └─ Task info + Status selector
          │  └─ <AdminNewInvoice/>
          │     └─ Form → API POST
          │
          ├─ /client/* (PROTECTED)
          │  ├─ <ClientDashboard/>
          │  │  └─ Quick stats + Recent tickets
          │  ├─ <ClientTicketsList/>
          │  │  └─ TicketCard[] → TicketDetail
          │  ├─ <ClientTicketDetail/>
          │  │  └─ Ticket info + Comments (read-only)
          │  ├─ <ClientNewTicket/>
          │  │  └─ Form → API POST
          │  └─ <ClientInvoicesList/>
          │     └─ InvoiceCard[] (download PDF)
          │
          └─ /specialist/* (PROTECTED)
             ├─ <SpecialistClientsList/>
             │  └─ ClientCard[] → ClientDetail
             ├─ <SpecialistClientDetail/>
             │  └─ View clients tickets
             └─ <SpecialistTicketDetail/>
                └─ Ticket + Comments (can add comments)
```

---

## Backend Route Structure

### Middleware Stack

```javascript
app.use(cors())                    // CORS handling
app.use(express.json())            // JSON parser
app.use(express.urlencoded())      // Form parser
app.use('/uploads', static)        // Static files

app.post('/api/auth/login', handler)
app.post('/api/auth/client-login', handler)
app.get('/api/auth/me', [authenticateToken], handler)

// Protected routes
app.get('/api/clients', [authenticateToken, requireRole], handler)
app.post('/api/clients', [authenticateToken, requireRole('admin')], handler)
// ... etc
```

### authenticateToken middleware
```javascript
(req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1]
  if (!token) return res.status(401).json({ error: '...' })
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: '...' })
    req.user = user  // { id, role, name }
    next()
  })
}
```

### requireRole(role) middleware
```javascript
(req, res, next) => {
  if (!role.includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied' })
  }
  next()
}
```

---

## Data Flow Examples

### Login Flow
```
User Input (Login.js)
    ↓
POST /api/auth/login
    ↓
Backend: Hash password → Compare with DB
    ↓
Generate JWT token
    ↓
Return token + user data
    ↓
Frontend: Store token in localStorage
    ↓
Set Authorization header for all future requests
    ↓
Redirect to dashboard based on role
```

### Create Ticket Flow
```
User: NewTicket.js form
    ↓
POST /api/tickets { title, description, client_id? }
    ↓
Backend: Insert into tickets table
    ↓
Return new ticket data { id, created_at, ... }
    ↓
Frontend: Navigate to /client/tickets/{id}
    ↓
GET /api/tickets/{id}
    ↓
Display ticket with comments
```

### Generate Invoice with QR Flow
```
Admin: ClientDetail.js → Generate Invoice Modal
    ↓
POST /api/invoices/generate {
  client_id,
  amount,
  serviceName,
  ...details
}
    ↓
Backend:
  1. Get client data from DB
  2. Call generateInvoicePdfBuffer()
  3. Create QR code with payment data
  4. Render PDF with PDFKit
  5. Save buffer to file
  6. Return file path
    ↓
Frontend:
  1. Download PDF or show in modal
  2. Store invoice record in DB
```

---

## Authentication Flow

```
Session Storage:
└─ localStorage
   ├─ token (JWT)
   ├─ user.id
   ├─ user.role
   └─ user.name

Protected Routes:
├─ ProtectedRoute component checks:
│  ├─ Is token present?
│  ├─ Is token valid?
│  ├─ Does user role match allowedRoles?
│  └─ Redirect to /login if not

API Requests:
└─ api.interceptor.request
   └─ Adds: Authorization: Bearer {token}
```

---

## State Management

### React Context (AuthContext)
```javascript
Context:
├─ user { id, email, role, name }
├─ token (JWT)
├─ loading
├─ error

Methods:
├─ login(email, password, role)
├─ logout()
└─ getUser() (from /api/auth/me)

Usage:
└─ const { user, token, login, logout } = useAuth()
```

### Component Local State
```javascript
// Typical page component:
const [data, setData] = useState(null)
const [loading, setLoading] = useState(true)
const [error, setError] = useState('')

useEffect(() => {
  fetchData()
}, [id])  // Re-fetch on ID change
```

---

## Database Relationships

```sql
users (admin/specialist)
  id ───┐
        └─→ comments.author_id
        └─→ tickets.assigned_to

clients
  id ─┬─→ client_logins.client_id
     ├─→ tickets.client_id
     ├─→ invoices.client_id
     └─→ tasks.client_id

tickets
  id ──→ comments.ticket_id

Key Constraints:
├─ client_logins.client_id → clients.id (CASCADE)
├─ tickets.client_id → clients.id (CASCADE)
├─ tickets.assigned_to → users.id (NULLABLE)
├─ comments.ticket_id → tickets.id (CASCADE)
├─ comments.author_id → users.id (CASCADE)
├─ invoices.client_id → clients.id (CASCADE)
└─ tasks.client_id → clients.id (CASCADE)
```

---

## Error Handling Patterns

### Backend
```javascript
try {
  const data = await someAsyncOp()
  res.json(data)
} catch (error) {
  console.error(error)
  res.status(500).json({ error: 'Server error' })
}

// Validation
if (!email || !password) {
  return res.status(400).json({ error: 'Missing fields' })
}

// Authentication
if (!token) {
  return res.status(401).json({ error: 'Unauthorized' })
}

// Authorization
if (user.role !== 'admin') {
  return res.status(403).json({ error: 'Forbidden' })
}
```

### Frontend
```javascript
try {
  const response = await api.post('/tickets', data)
  navigate(`/client/tickets/${response.data.id}`)
} catch (error) {
  setError(error.response?.data?.error || 'Network error')
} finally {
  setLoading(false)
}
```

---

## Styling Architecture

### Tailwind CSS
```html
<!-- Utility-first approach -->
<div className="flex gap-4 p-6 bg-white rounded-lg shadow-md">
  <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
    Action
  </button>
</div>
```

### CSS Modules / Global Styles
```css
/* index.css - Global styles */
/* App.css - App-specific styles */
/* tailwind.css - Tailwind directives */
```

### Color Scheme
- Primary: `primary-600` (blue) 
- Success: `green-600`
- Warning: `yellow-600`
- Error: `red-600`
- Neutral: `gray-*`

---

## Performance Optimizations

### Frontend
- ✅ Code splitting with React Router
- ✅ useCallback for handler memoization
- ✅ useMemo for computed values
- ✅ Lazy image loading with next-gen formats
- ✅ CSS minification via Tailwind

### Backend
- ✅ Connection pooling (SQLite)
- ✅ Gzip compression via nginx
- ✅ Static file caching via nginx
- ✅ JWT verification middleware
- ✅ Database indexing (on frequently queried columns)

### Network
- ✅ CORS preflight optimization
- ✅ Batch API requests with Promise.all
- ✅ PDF generation on-demand (not pre-rendered)

---

## Security Measures

### Authentication
- ✅ JWT tokens with 24-hour expiry
- ✅ Password hashing with bcryptjs
- ✅ Secure token storage (localStorage)
- ✅ Token validation on every request

### Authorization
- ✅ Role-based access control (RBAC)
- ✅ Client data isolation (users see only their data)
- ✅ Specialist limited to assigned clients

### Input Validation
- ✅ Frontend form validation
- ✅ Backend input validation
- ✅ SQL injection prevention via parameterized queries

### CORS
- ✅ Whitelist of allowed origins
- ✅ Credentials: true only where needed
- ✅ Preflight requests handling

### Data Protection
- ⚠️ TODO: Add HTTPS enforcement
- ⚠️ TODO: Add rate limiting
- ⚠️ TODO: Add request logging
- ⚠️ TODO: Add audit trail for admin actions

--- 

## Deployment Architecture

```
┌─────────────────┐
│   Git Webhook   │
│   (GitHub)      │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│   install.sh (Deployment)       │
│  ┌───────────────────────────┐  │
│  │ 1. Pull latest code       │  │
│  │ 2. Install dependencies   │  │
│  │ 3. Build React app        │  │
│  │ 4. Configure Nginx        │  │
│  │ 5. Setup SSL (Let's Enc.) │  │
│  │ 6. Restart services       │  │
│  └───────────────────────────┘  │
└────────────┬────────────────────┘
             │
    ┌────────▼────────┐
    │ Production      │
    │ Server (AWS/VPS)│
    │                 │
    │ ┌─────────────┐ │
    │ │ Nginx Port  │ │
    │ │ 80/443      │ │
    │ └──────┬──────┘ │
    │        │        │
    │   ┌────▼─────┐  │
    │   │ Express  │  │
    │   │ :5001    │  │
    │   └──────────┘  │
    │        │        │
    │   ┌────▼──────┐ │
    │   │ SQLite DB │ │
    │   └───────────┘ │
    └─────────────────┘
```

---

## Development Workflow

### Local Development
```bash
# 1. Clone repo
git clone https://github.com/nemkoff94/HELPDESK.git
cd HELPDESK

# 2. Install all dependencies
npm run install-all

# 3. Start dev servers
npm run dev

# This runs:
# - Backend: http://localhost:5001
# - Frontend: http://localhost:3000
```

### Feature Development
```bash
# 1. Create feature branch
git checkout -b feature/new-feature

# 2. Make changes
# - Edit backend: server/index.js
# - Edit frontend: client/src/

# 3. Test locally
# - Check http://localhost:3000
# - Check API via curl/postman

# 4. Commit changes
git add .
git commit -m "feat: add new feature"

# 5. Push and create PR
git push origin feature/new-feature
```

### Production Deployment
```bash
# 1. Merge to main
git checkout main
git merge feature/new-feature

# 2. Push to main
git push origin main

# 3. Server pulls and runs install.sh automatically
# OR manually:
ssh user@obs-panel.ru
cd /path/to/HELPDESK
./install.sh
```

---

## Common Tasks

### Adding a New API Endpoint

1. **Backend** (server/index.js)
```javascript
app.get('/api/resource/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM resource WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: '...' });
    if (!row) return res.status(404).json({ error: '...' });
    res.json(row);
  });
});
```

2. **Frontend** (client/src/pages/)
```javascript
import api from '../../api';
import { useParams } from 'react-router-dom';

const ResourceDetail = () => {
  const { id } = useParams();
  const [resource, setResource] = useState(null);
  
  useEffect(() => {
    api.get(`/resource/${id}`)
      .then(res => setResource(res.data))
      .catch(err => console.error(err));
  }, [id]);
  
  return <div>{resource?.name}</div>;
};
```

3. **Routing** (client/src/App.tsx)
```javascript
<Route path="/resource/:id" element={
  <ProtectedRoute allowedRoles={['admin']}>
    <ResourceDetail />
  </ProtectedRoute>
} />
```

### Adding a New Database Table

1. **Schema** (server/index.js, in db initialization)
```javascript
db.run(`
  CREATE TABLE IF NOT EXISTS resources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
```

2. **Add API endpoints** for CRUD operations
3. **Add migration notes** to this documentation

---

## Troubleshooting

### Backend Issues

**Port already in use**
```bash
# Kill process on port 5001
lsof -ti:5001 | xargs kill -9
# Or change PORT in .env
```

**Database locked**
```bash
# Delete DB and restart (dev only!)
rm server/helpdesk.db
npm run server
```

**CORS errors**
- Check ALLOWED_ORIGINS in server/index.js
- Add localhost:3000 or your domain

### Frontend Issues

**Blank page / 404**
- Check if backend is running (http://localhost:5001)
- Check if API_URL in api.js is correct
- Clear localStorage and refresh

**Token expired**
- Login again
- Or increase JWT expiry in backend

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-11-26 | Initial release |

---

**Last Updated:** 26 ноября 2025
