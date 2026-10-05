require('dotenv').config();

const path = require("node:path");
const router = require("./routes/router");
const express = require("express");
const session = require("express-session");
const passport = require("./auth/passport");

const PORT = process.env.PORT || 3000;

const app = express();

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(session({ secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'))
app.use(router)

const server = app.listen(PORT, () => {
  console.log(`app listening on port ${PORT}!`);
});

server.on('error', (error) => {
  console.error('Failed to start server:', error.message);
});
