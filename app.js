require('dotenv').config();

const path = require('node:path');
const router = require('./routes/router');
const express = require('express');
const { PrismaSessionStore } = require('@quixo3/prisma-session-store');
const { prisma } = require('./lib/prisma');
const expressSession = require('express-session');
const passport = require('./auth/passport');

const PORT = process.env.PORT || 3000;

const app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.set('trust proxy', 1);

app.use(
  expressSession({
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    },
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: new PrismaSessionStore(prisma, {
      checkPeriod: 2 * 60 * 1000,
      dbRecordIdIsSessionId: true,
      dbRecordIdFunction: undefined,
    }),
  }),
);

app.use(passport.initialize());
app.use(passport.session());
app.use(async (req, res, next) => {
  res.locals.user = req.user || null;

  if (req.user) {
    try {
      // Считаем сумму колонки size для всех файлов этого юзера в БД
      const stats = await prisma.file.aggregate({
        where: { userId: req.user.id },
        _sum: { size: true },
      });

      const usedBytes = stats._sum.size || 0;
      const maxMB = 500; // Лимит на юзера в МБ (можешь поставить 100 или 1000)
      const maxBytes = maxMB * 1024 * 1024;

      res.locals.usedMB = (usedBytes / (1024 * 1024)).toFixed(1);
      res.locals.maxMB = maxMB;
      res.locals.usedPercent = Math.min(
        100,
        Math.round((usedBytes / maxBytes) * 100),
      );
    } catch (err) {
      console.error('Storage calc error:', err);
      res.locals.usedMB = '0.0';
      res.locals.maxMB = 500;
      res.locals.usedPercent = 0;
    }
  }

  next();
});
app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));
app.use(router);

const server = app.listen(PORT, () => {
  console.log(`app listening on port ${PORT}!`);
});

server.on('error', (error) => {
  console.error('Failed to start server:', error.message);
});
