const passport = require('../auth/passport');
const { prisma } = require('../lib/prisma');
const { supabase } = require('../lib/supabase');
const path = require('node:path');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const SORTS = {
  date: { createdAt: 'desc' },
  name: { name: 'asc' },
  size: { size: 'desc' },
};

exports.home = async (req, res) => {
  const q = (req.query.q || '').trim();
  const sort = SORTS[req.query.sort] ? req.query.sort : 'date';
  let files = [];
  let folders = [];

  if (req.user) {
    files = await prisma.file.findMany({
      where: {
        userId: req.user.id,
        folderId: null,
        ...(q && { name: { contains: q, mode: 'insensitive' } }),
      },
      orderBy: SORTS[sort],
    });
    folders = await prisma.folder.findMany({
      where: {
        userId: req.user.id,
        ...(q && { name: { contains: q, mode: 'insensitive' } }),
      },
      include: { _count: { select: { files: true } } },
    });
  }

  res.render('index', {
    title: 'Home',
    user: req.user,
    currentFolder: null,
    folders,
    files,
    q,
    sort,
  });
};

exports.about = (req, res) => {
  res.render('about', { title: 'About' });
};

exports.contact = (req, res) => {
  res.render('contact', { title: 'Contact' });
};

exports.upgrade = (req, res) => {
  res.render('upgrade', { title: 'Upgrade' });
};

// authorization\registration
exports.login = (req, res) => {
  res.render('login', { title: 'Login' });
};
exports.register = (req, res) => {
  res.render('register', { title: 'Register' });
};

exports.registerPost = async (req, res, next) => {
  const { email, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    console.error('Passwords do not match');
    return res.redirect('/register');
  }

  if (password.length < 5) {
    return res.redirect('/register');
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password_hash: hashedPassword,
      },
    });

    req.login(user, (err) => {
      if (err) {
        console.error('Auto-login error:', err);
        return next(err);
      }
      return res.redirect('/');
    });
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

exports.logOut = (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    res.redirect('/');
  });
};
// File==File==File==File==File==File==File==File==File==File==File==
// Upload file
exports.upload = async (req, res) => {
  if (!req.file) return res.redirect('/');
  const file = req.file;
  const userId = req.user.id;
  const randomId = crypto.randomUUID();
  const fileName = `${userId}/${randomId}${path.extname(file.originalname)}`;
  const bucketName = process.env.SUPABASE_BUCKET;
  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });
  if (error) {
    throw error;
  }
  prisma.file
    .create({
      data: {
        name: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        path: fileName,
        owner: { connect: { id: req.user.id } },
      },
    })
    .then(() => res.redirect('/'))
    .catch((err) => {
      console.error(err);
      supabase.storage.from(bucketName).remove([fileName]);
      res.redirect('/');
    });
};

// Download file
exports.download = async (req, res) => {
  const fileId = parseInt(req.params.id, 10);

  if (Number.isNaN(fileId)) {
    return res.status(400).send('Invalid file ID');
  }

  try {
    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
        userId: req.user.id,
      },
    });
    if (!file) {
      return res.status(404).send('File not found');
    }

    const { data, error } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET)
      .createSignedUrl(file.path, 6000);

    if (error) {
      return res
        .status(500)
        .send('Error dowloading file from Supabase' + error);
    } else {
      return res.redirect(data.signedUrl);
    }
  } catch (err) {
    console.error('Error installing file' + err);
    return res.status(500).send('Internal Server Error');
  }
};

// 1. Рендер страницы Shared со списком файлов юзера
exports.sharedPage = async (req, res) => {
  if (!req.user) {
    // Если не залогинен — рендерим гостевую заглушку, которую делали ранее
    return res.render('shared-guest');
  }

  try {
    const files = await prisma.file.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });

    res.render('shared', {
      title: 'Share Hub',
      user: req.user,
      files,
    });
  } catch (err) {
    console.error('Error loading shared page:', err);
    res.status(500).send('Internal Server Error');
  }
};

// 2. API генерации ссылки (поддерживает выбор времени жизни в секундах)
exports.shareFile = async (req, res) => {
  const fileId = parseInt(req.params.id, 10);
  // Берем время жизни из query (?expires=86400), по умолчанию 7 дней (604800 сек)
  const expiresIn = parseInt(req.query.expires, 10) || 60 * 60 * 24 * 7;

  if (Number.isNaN(fileId)) {
    return res.status(400).json({ error: 'Invalid file ID' });
  }

  try {
    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
        userId: req.user.id,
      },
    });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const { data, error } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET)
      .createSignedUrl(file.path, expiresIn);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ url: data.signedUrl });
  } catch (err) {
    console.error('Error sharing file:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Delete file
exports.deleteFile = async (req, res) => {
  const fileId = parseInt(req.params.id, 10);

  if (Number.isNaN(fileId)) {
    return res.status(400).send('Invalid file ID');
  }

  try {
    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
        userId: req.user.id,
      },
    });
    if (!file) {
      return res.status(404).send('File not found');
    }

    const { data, error } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET)
      .remove([file.path]);

    if (error) {
      return res.status(500).send('Error deleting file from Supabase');
    } else {
      console.log('File deleted from Supabase:', data);
    }
    await prisma.file.delete({
      where: { id: fileId },
    });

    if (file.folderId) {
      return res.redirect('/folders/' + file.folderId);
    }
    return res.redirect('/');
  } catch (err) {
    console.error('Error deleting file:', err);
    return res.status(500).send('Internal Server Error');
  }
};

// Folder==Folder==Folder==Folder==Folder==Folder==Folder==Folder==Folder==Folder
//Create folder
exports.createFolder = async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).send('Folder name is required');
  }

  try {
    await prisma.folder.create({
      data: {
        name,
        owner: { connect: { id: req.user.id } },
      },
    });
    res.redirect('/');
  } catch (err) {
    console.error('Error creating folder:', err);
    res.status(500).send('Internal Server Error');
  }
};

// Open folder
exports.openFolder = async (req, res) => {
  const q = (req.query.q || '').trim();
  const sort = SORTS[req.query.sort] ? req.query.sort : 'date';
  const folderId = parseInt(req.params.id, 10);
  if (Number.isNaN(folderId)) {
    return res.status(400).send('Invalid folder ID');
  }

  const folder = await prisma.folder.findFirst({
    where: { id: folderId, userId: req.user.id },
    include: { files: { orderBy: { createdAt: 'desc' } } },
  });
  if (!folder) {
    return res.status(404).send('Folder not found');
  }

  res.render('index', {
    title: folder.name,
    user: req.user,
    currentFolder: folder,
    folders: [],
    files: folder.files,
    q,
    sort,
  });
};

// Rename folder
exports.renameFolder = async (req, res) => {
  const folderId = parseInt(req.params.id, 10);
  const { newName } = req.body;

  if (Number.isNaN(folderId)) {
    return res.status(400).send('Invalid folder ID');
  }
  if (!newName) {
    return res.status(400).send('New folder name is required');
  }

  try {
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, userId: req.user.id },
    });
    if (!folder) {
      return res.status(404).send('Folder not found');
    }

    await prisma.folder.update({
      where: { id: folderId },
      data: { name: newName },
    });

    res.redirect(`/`);
  } catch (err) {
    console.error('Error renaming folder:', err);
    res.status(500).send('Internal Server Error');
  }
};

// Delete folder
exports.deleteFolder = async (req, res) => {
  const folderId = parseInt(req.params.id, 10);
  if (Number.isNaN(folderId)) {
    return res.status(400).send('Invalid folder ID');
  }

  try {
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, userId: req.user.id },
      include: { files: true },
    });
    if (!folder) {
      return res.status(404).send('Folder not found');
    }

    // Delete all files in the folder
    for (const file of folder.files) {
      if (file.path && fs.existsSync(file.path)) {
        fs.unlink(file.path, (err) => {
          if (err) console.error('Error deleting physical file:', err);
        });
      }
    }

    await prisma.file.deleteMany({
      where: { folderId: folderId },
    });

    await prisma.folder.delete({
      where: { id: folderId },
    });

    res.redirect('/');
  } catch (err) {
    console.error('Error deleting folder:', err);
    res.status(500).send('Internal Server Error');
  }
};

// Upload file to folder
exports.uploadToFolder = async (req, res) => {
  if (!req.file) return res.redirect('/');
  const folderId = parseInt(req.params.id, 10);
  if (Number.isNaN(folderId)) {
    console.error('Invalid folder ID:', req.params.id);
    return res.status(400).send('Invalid folder ID');
  }
  const folder = await prisma.folder.findFirst({
    where: { id: folderId, userId: req.user.id },
  });
  if (!folder) {
    console.error(
      'Folder not found for user:',
      req.user.id,
      'Folder ID:',
      folderId,
    );
    return res.status(404).send('Folder not found');
  }
  const file = req.file;
  const userId = req.user.id;
  const randomId = crypto.randomUUID();
  const fileName = `${userId}/${randomId}${path.extname(file.originalname)}`;
  const bucketName = process.env.SUPABASE_BUCKET;

  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });
  if (error) {
    throw error;
  }

  await prisma.file
    .create({
      data: {
        name: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        path: fileName,
        owner: { connect: { id: req.user.id } },
        folder: { connect: { id: folderId } },
      },
    })
    .then(() => res.redirect(`/folders/${folderId}`))
    .catch((err) => {
      console.error(err);
      supabase.storage.from(bucketName).remove([fileName]);
      res.redirect(`/folders/${folderId}`);
    });
};
