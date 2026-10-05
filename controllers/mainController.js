//const db = require('../db/queries')
//const passport = require("../auth/passport");

exports.home = async (req, res) => {
  //const messages = await db.getMessageInfo();
  res.render('index', { title: 'Home' });
};
