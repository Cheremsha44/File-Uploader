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

app.use(
  expressSession({
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // ms
    },
    secret: 'a santa at nasa',
    resave: false,
    saveUninitialized: false,
    store: new PrismaSessionStore(prisma, {
      checkPeriod: 2 * 60 * 1000, //ms
      dbRecordIdIsSessionId: true,
      dbRecordIdFunction: undefined,
    }),
  }),
);

app.use(passport.initialize());
app.use(passport.session());
app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));
app.use(router);

const server = app.listen(PORT, () => {
  console.log(`app listening on port ${PORT}!`);
});

server.on('error', (error) => {
  console.error('Failed to start server:', error.message);
});
