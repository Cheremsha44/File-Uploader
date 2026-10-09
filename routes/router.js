const { Router } = require('express');
const mainController = require('../controllers/mainController');
const router = Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

router.get('/', mainController.home);

// authorization\registration\log-out
router.get('/login', mainController.login);
router.post('/login', mainController.loginPost);

router.get('/register', mainController.register);
router.post('/register', mainController.registerPost);

router.get('/log-out', mainController.logOut);
// ================================================
// Upload files
router.post('/upload', upload.single('file'), mainController.upload);

module.exports = router;
