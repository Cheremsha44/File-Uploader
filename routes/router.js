const { Router } = require('express');
const mainController = require('../controllers/mainController');
const path = require('path');
const router = Router();
const multer = require('multer');

function checkFileType(file, cb) {
  const filetypes =
    /jpeg|jpg|png|gif|webp|svg|pdf|doc|docx|txt|md|zip|rar|7z|mp3|wav|mp4|mkv/;
  const mimetypes =
    /image\/(jpeg|png|gif|webp|svg\+xml)|application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document|zip|x-rar-compressed|x-7z-compressed)|text\/(plain|markdown)|audio\/(mpeg|wav)|video\/(mp4|x-matroska)/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = mimetypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(
      new Error(
        'Unsupported file type! Allowed: images, documents, archives, audio, video.',
      ),
    );
  }
}
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5000000 },
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  },
});

const { autorized } = require('../middlewares/auth');

router.get('/', mainController.home);

router.get('/about', mainController.about);
router.get('/contact', mainController.contact);
router.get('/upgrade', mainController.upgrade);

// authorization\registration\log-out
router.get('/login', mainController.login);
router.post('/login', mainController.loginPost);

router.get('/register', mainController.register);
router.post('/register', mainController.registerPost);

router.get('/log-out', mainController.logOut);
// File==File==File==File==File==File==File==File==File==File==File==File==File==File==
// Upload files
router.post('/upload', autorized, upload.single('file'), mainController.upload);
// Install file
router.get('/download/:id', autorized, mainController.download);
// Delete file
router.post('/delete-file/:id', autorized, mainController.deleteFile);
router.get('/shared', autorized, mainController.sharedPage);
router.get('/share/:id', autorized, mainController.shareFile);

// Folder==Folder==Folder==Folder==Folder==Folder==Folder==Folder==Folder==Folder
// Create folder
router.post('/create-folder', autorized, mainController.createFolder);
// Open folder
router.get('/folders/:id', autorized, mainController.openFolder);
// Rename folder
router.post('/folders/:id/rename', autorized, mainController.renameFolder);
// Delete folder
router.post('/folders/:id/delete', autorized, mainController.deleteFolder);
// Upload file to folder
router.post(
  '/folders/:id/upload',
  autorized,
  upload.single('file'),
  mainController.uploadToFolder,
);

module.exports = router;
