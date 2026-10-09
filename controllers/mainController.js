//const db = require('../db/queries')
const passport = require('../auth/passport');
const { prisma } = require('../lib/prisma');
const bcrypt = require('bcryptjs');

exports.home = async (req, res) => {
  const files = req.user
    ? await prisma.file.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
      })
    : [];
  res.render('index', { title: 'Home', user: req.user, files });
};

// authorization\registration
exports.login = (req, res) => {
  res.render('login', { title: 'Login' });
};
exports.register = (req, res) => {
  res.render('register', { title: 'Register' });
};

exports.registerPost = async (req, res) => {
  const { email, password, confirmPassword } = req.body;
  if (password !== confirmPassword) {
    console.error('Passwords do not match');
    return res.redirect('/register');
  }
  if (password.length < 6) {
    return res.redirect('/register');
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        email,
        password_hash: hashedPassword,
      },
    });

    res.redirect('/login');
  } catch (err) {
    console.error('Registration error:', err);
    res.redirect('/register');
  }
};
exports.loginPost = (req, res, next) => {
  passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
  })(req, res, next);
};

exports.logOut = (req, res) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    res.redirect('/');
  });
};
// ================================================
exports.upload = async (req, res) => {
  if (!req.file) return res.redirect('/');
  const { originalname, size, mimetype, path } = req.file;
  prisma.file
    .create({
      data: {
        name: originalname,
        size: size,
        mimetype: mimetype,
        path: path,
        owner: { connect: { id: req.user.id } },
      },
    })
    .then(() => res.redirect('/'))
    .catch((err) => {
      console.error(err);
      res.redirect('/');
    });
};
