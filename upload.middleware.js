const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB is plenty for a product CSV
  fileFilter: (req, file, cb) => {
    const okTypes = ['text/csv', 'application/vnd.ms-excel', 'application/csv'];
    if (okTypes.includes(file.mimetype) || file.originalname.toLowerCase().endsWith('.csv')) {
      return cb(null, true);
    }
    cb(new Error('Only .csv files are accepted for bulk upload.'));
  },
});

module.exports = upload;
