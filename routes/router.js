const { Router } = require('express');
const mainController = require('../controllers/mainController');
const router = Router();

router.get('/', mainController.home);

// authorization\registration
router.get('/login', mainController.login);
router.post('/login', mainController.loginPost);

router.get('/register', mainController.register);
router.post('/register', mainController.registerPost);

module.exports = router;
