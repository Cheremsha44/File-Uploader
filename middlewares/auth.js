// function requireMinStatus(minStatusId) {
//   return (req, res, next) => {
//     if (!req.user) {
//       return res.status(401).send('Не авторизован');
//     }
//     if (req.user.status_id < minStatusId) {
//       return res.status(403).send('Недостаточно прав');
//     }
//     next();
//   };
// }

// module.exports = { requireMinStatus };
