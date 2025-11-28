require('dotenv').config();

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const MySQLStore = require('express-mysql-session')(session);
const flashMiddleware = require('./middleware/flash');
const viewLocals = require('./middleware/viewLocals');
const db = require('./db');
const { startReminderWorker } = require('./reminderWorker');

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const adminRoutes = require('./routes/admin');
const publicRoutes = require('./routes/public');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layout');

app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use(bodyParser.urlencoded({ extended: true, limit: '5mb' }));
app.use(methodOverride('_method'));

const sessionStore = new MySQLStore(
  {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'jumuah_app'
  }
);

app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'very-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7
    }
  })
);

app.use(expressLayouts);
app.use(flashMiddleware);
app.use(viewLocals);

app.use(authRoutes);
app.use(dashboardRoutes);
app.use(adminRoutes);
app.use(publicRoutes);

app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  return res.redirect('/login');
});

app.use((req, res) => {
  res.status(404).render('not_found', { title: 'Not Found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Jumuah speaker app listening on http://localhost:${PORT}`);
  startReminderWorker();
});
